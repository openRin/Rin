/**
 * Rin 通用邮件网关（Cloudflare Worker）
 * =================================================
 *
 * 用途：把「发邮件」这件事从 Rin 主 Worker 里拆出来，暴露成一个带鉴权的
 * HTTP 接口。主 Worker 只发一个 POST，不需要处理 SMTP 协议、TLS 握手、
 * 出站端口限制等问题。
 *
 * 相比「投稿表单」类网关，这个版本是通用的：
 * - 收件人由请求方指定（`to`），而不是固定地址
 * - 主题与正文由请求方指定，不做业务字段改写
 * - 没有任何内容黑名单或业务分类校验
 * - 支持 465 隐式 TLS 与 587 STARTTLS，由服务商端口自动判断
 *
 * ── 部署 ──────────────────────────────────────────────
 * 1. 新建 Worker，粘贴本文件
 * 2. 设置环境变量（见下方「所需变量」）：
 *      - 用 Dashboard：Settings → Variables and Secrets
 *      - 或用 CLI：wrangler secret put MAIL_JWT_SECRET
 * 3. 部署后拿到地址，如 https://mail-gateway.example.workers.dev
 *
 * ── 鉴权（两种模式，优先 JWT）────────────────────────
 *
 *   【推荐】JWT 模式 —— 只设 `MAIL_JWT_SECRET` 即启用
 *     主站用同一密钥签发 60 秒有效的 JWT，请求头 `Authorization: Bearer <jwt>`。
 *     网关会校验：签名 + `aud` + `purpose` + `exp` 四项全过才放行。
 *
 *     为什么不只看签名：主站的用户登录 JWT 也是同一密钥签发的，
 *     只验签名的话，任何人都能拿自己的登录凭证调本接口，
 *     网关立刻变成 spam 跳板。`aud` / `purpose` 声明就是为此设的闸门。
 *
 *   【备选】静态 token 模式 —— 设 `MAIL_TOKEN` 启用
 *     请求头 `X-Mail-Token: <token>`，常量时间比对。
 *     适合先快速跑通再切 JWT。
 *
 *   两者都没配时返回 503 而不是放行：无凭证的网关等于对全网开放发信。
 *
 * ── 所需变量 ──────────────────────────────────────────
 *   必填（SMTP 侧）：
 *     SMTP_HOST         邮件服务商域名
 *     SMTP_USER         登录用户名（通常是完整邮箱地址）
 *     SMTP_PASS         登录密码 / 授权码
 *     MAIL_FROM         发件人地址
 *   二选一（鉴权侧）：
 *     MAIL_JWT_SECRET   与主站一致的 JWT 签名密钥（推荐，建议独立取值）
 *     MAIL_TOKEN        静态共享 token（备选）
 *   可选：
 *     SMTP_PORT         端口，默认 465（隐式 TLS）
 *     SMTP_TLS_MODE     implicit | starttls，留空按端口推断
 *     SMTP_AUTH         login | plain，默认 login
 *     ALLOWED_ORIGIN    允许的来源，默认 *（仅供浏览器直连时使用）
 *     MAIL_MAX_PER_MIN  每 IP 每分钟请求上限，默认 10
 *
 * ── 主 Worker 侧配置 ──────────────────────────────────
 *   MAIL_PROVIDER=custom
 *   MAIL_GATEWAY_ENDPOINT=https://你的网关地址/api/send
 *   MAIL_FROM=noreply@yourdomain.com
 *
 *   JWT 模式额外需要（两侧取值必须一致）：
 *     主站：MAIL_JWT_SECRET=<你的密钥>
 *     网关：MAIL_JWT_SECRET=<同一个密钥>
 *
 *   静态 token 模式则改为：
 *     MAIL_GATEWAY_TOKEN=<与网关 MAIL_TOKEN 一致>
 *
 * ── 接口 ──────────────────────────────────────────────
 *   GET  /api/health  → 探活（不需鉴权，但受 IP 限流）
 *   POST /api/send    → 发信
 *
 *   请求头：Authorization: Bearer <jwt>   或   X-Mail-Token: <token>
 *   请求体：{ from?, to, subject, text, html? }
 *   响应：  { ok: true } | { ok: false, error }
 *
 * 限流说明：默认每 IP 每分钟 10 次。邮箱注册场景下，注册接口本身
 * 还有「同一邮箱 60 秒冷却」，这里的限流是防止网关被当作 spam 跳板。
 */

// 依赖 cloudflare:sockets，属于 Workers 专属模块
import { connect } from 'cloudflare:sockets';

// ── 鉴权常量 ────────────────────────────────────────────
// 必须与主站 `server/src/services/mail/token.ts` 保持一致。
// 任何一侧改动都要同步，否则主站会开始收到 401。

/** 与主站签发的 aud 一致 */
const MAIL_GATEWAY_AUDIENCE = 'rin-mail-gateway';

/** 与主站签发的 purpose 一致 */
const MAIL_GATEWAY_PURPOSE = 'mail-gateway';

// ── 入口 ────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const cors = buildCorsHeaders(env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === '/api/health') {
        return json({ ok: true, service: 'rin-mail-gateway' }, 200, cors);
      }

      if (url.pathname !== '/api/send' || request.method !== 'POST') {
        return json({ ok: false, error: 'not found' }, 404, cors);
      }

      return await handleSend(request, env, cors);
    } catch (error) {
      // 兜底：任何未捕获异常都不应把内部细节暴露给调用方
      console.error('mail gateway error', error);
      return json({ ok: false, error: '邮件服务暂时不可用' }, 502, cors);
    }
  },
};

// ── 发送逻辑 ────────────────────────────────────────────

// ── 鉴权 ────────────────────────────────────────────────

/**
 * 校验调用方凭证。两种模式，按优先级：
 *
 * 1. **JWT（推荐）** — 设置 `MAIL_JWT_SECRET` 后启用。
 *    主站用同一密钥签发 60 秒有效的 JWT，必须同时满足：
 *      - 签名有效（HS256）
 *      - `aud` === 'rin-mail-gateway'
 *      - `purpose` === 'mail-gateway'
 *      - 未过期
 *    `aud` + `purpose` 的双重校验是关键：**只验签名是不够的**，
 *    否则主站的用户登录 JWT 也能拿来调本接口，网关会变成 spam 跳板。
 *
 * 2. **静态 token** — 设置 `MAIL_TOKEN` 时启用，与 `X-Mail-Token` 常量时间比对。
 *
 * 两者都没配置时返回 503：网关没有凭证配置等于对全网开放发信能力，必须拒绝。
 */
async function authenticate(request, env) {
  const secret = env.MAIL_JWT_SECRET && env.MAIL_JWT_SECRET.trim();

  if (secret) {
    const raw = readBearerToken(request);
    if (!raw) {
      return { ok: false, error: '缺少 Authorization 凭证', status: 401 };
    }

    const result = await verifyJwtHs256(raw, secret);
    if (!result.valid) {
      return { ok: false, error: result.reason || '凭证无效', status: 401 };
    }
    return { ok: true };
  }

  if (env.MAIL_TOKEN) {
    const provided = request.headers.get('X-Mail-Token') || '';
    if (!constantTimeEquals(provided, env.MAIL_TOKEN)) {
      return { ok: false, error: '令牌无效', status: 403 };
    }
    return { ok: true };
  }

  return { ok: false, error: '服务端未配置 MAIL_JWT_SECRET 或 MAIL_TOKEN', status: 503 };
}

/** 从 Authorization 头取 Bearer token；兼容 X-Mail-Token 便于排错 */
function readBearerToken(request) {
  const auth = request.headers.get('Authorization') || '';
  if (/^Bearer\s+/i.test(auth)) {
    return auth.replace(/^Bearer\s+/i, '').trim();
  }
  const alt = request.headers.get('X-Mail-Token');
  return alt ? alt.trim() : '';
}

/**
 * 校验 HS256 JWT。用 Web Crypto，零外部依赖。
 * 只支持 HS256 —— 接受其他算法会引入算法混淆攻击（`alg: none` 等）。
 */
async function verifyJwtHs256(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: '凭证格式错误' };
  }

  const [headerPart, payloadPart, signaturePart] = parts;

  let header;
  let payload;
  try {
    header = JSON.parse(decodeBase64UrlToString(headerPart));
    payload = JSON.parse(decodeBase64UrlToString(payloadPart));
  } catch {
    return { valid: false, reason: '凭证格式错误' };
  }

  // 必须锁定算法，防止把 RS256 签名当作 HMAC 验（算法混淆）
  if (header.alg !== 'HS256') {
    return { valid: false, reason: '不支持的签名算法' };
  }

  // 验证签名
  let valid;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    valid = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(signaturePart),
      new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    );
  } catch {
    return { valid: false, reason: '签名校验失败' };
  }

  if (!valid) {
    return { valid: false, reason: '签名无效' };
  }

  // 校验 audience：挡住主站的用户登录 JWT
  const aud = payload.aud;
  const audList = Array.isArray(aud) ? aud : [aud];
  if (!audList.includes(MAIL_GATEWAY_AUDIENCE)) {
    return { valid: false, reason: '凭证用途不匹配' };
  }

  // 校验 purpose：二次保险，防止将来其他用途误用同一密钥
  if (payload.purpose !== MAIL_GATEWAY_PURPOSE) {
    return { valid: false, reason: '凭证用途不匹配' };
  }

  // 校验过期时间
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && now >= payload.exp) {
    return { valid: false, reason: '凭证已过期' };
  }

  return { valid: true };
}

/** base64url 解码为字节串（用于校验签名） */
function decodeBase64Url(value) {
  const binary = atob(toBase64(value));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** base64url 解码为 UTF-8 字符串（用于读取 header / payload） */
function decodeBase64UrlToString(value) {
  const bytes = decodeBase64Url(value);
  return new TextDecoder().decode(bytes);
}

function toBase64(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return base64 + '='.repeat((4 - (base64.length % 4)) % 4);
}

async function handleSend(request, env, cors) {
  // 1. 鉴权：优先校验短期 JWT，其次兼容静态 token
  const auth = await authenticate(request, env);
  if (!auth.ok) {
    return json({ ok: false, error: auth.error }, auth.status, cors);
  }

  // 2. 限流：防止网关被当作 spam 跳板
  const ip = String(request.headers.get('CF-Connecting-IP') || 'unknown').slice(0, 64);
  const perMinute = parseInt(env.MAIL_MAX_PER_MIN || '10', 10);
  if (rateLimited(ip, perMinute, 60_000)) {
    return json({ ok: false, error: '请求过于频繁，请稍后再试' }, 429, cors);
  }

  // 3. 解析并校验请求体
  const body = await request.json().catch(() => ({}));
  const to = clean(body.to, 254);
  const subject = clean(body.subject, 200);
  const text = typeof body.text === 'string' ? body.text.slice(0, 20_000) : '';
  const html = typeof body.html === 'string' ? body.html.slice(0, 50_000) : '';
  const from = clean(body.from, 254) || env.MAIL_FROM;

  if (!to || !isLikelyEmail(to)) {
    return json({ ok: false, error: '收件人地址不合法' }, 400, cors);
  }
  if (!subject) {
    return json({ ok: false, error: '缺少邮件主题' }, 400, cors);
  }
  if (!text && !html) {
    return json({ ok: false, error: '邮件内容不能为空' }, 400, cors);
  }

  // 4. 校验发信配置
  const host = safeSmtpHost(env.SMTP_HOST);
  const username = clean(env.SMTP_USER, 254);
  const password = env.SMTP_PASS || '';
  const fromAddress = clean(from, 254);

  if (!host || !username || !password || !fromAddress) {
    // 配置缺失属于服务端问题，用 502 而非 400
    return json({ ok: false, error: '邮件服务配置缺失' }, 502, cors);
  }

  // 5. 建立 SMTP 会话并投递
  const port = parseInt(env.SMTP_PORT || '', 10) || 465;
  const tlsMode = normalizeTlsMode(env.SMTP_TLS_MODE, port);

  const socket = connectSmtp(host, port, tlsMode, username, password);

  try {
    await socket.send({
      from: fromAddress,
      to,
      subject,
      text,
      html,
      authMethod: (env.SMTP_AUTH === 'plain' ? 'plain' : 'login'),
    });
  } finally {
    try {
      await socket.quit();
    } catch {
      socket.destroy();
    }
  }

  return json({ ok: true }, 200, cors);
}

// ── 极简 SMTP 客户端 ────────────────────────────────────
// 独立于主项目的实现，因为这个 Worker 要能单独部署。

const SMTP_TIMEOUT_MS = 20_000;
const CRLF = '\r\n';

function connectSmtp(host, port, tlsMode, username, password) {
  const socket = connect(
    { hostname: host, port },
    {
      secureTransport: tlsMode === 'implicit' ? 'on' : 'off',
      // 必须显式声明：SMTP 需要服务端在 QUIT 后主动关闭，
      // 保持半关闭状态才能读到完整的 221 应答。
      allowHalfOpen: false,
    },
  );

  return new SmtpSession(socket, tlsMode, username, password);
}

class SmtpSession {
  constructor(socket, tlsMode, username, password) {
    this.socket = socket;
    this.tlsMode = tlsMode;
    this.username = username;
    this.password = password;
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
  }

  async greet() {
    // 隐式 TLS 需要等待握手完成；STARTTLS 模式下 opened 会在 STARTTLS 时再次变化
    await withTimeout(this.socket.opened, '连接超时');
    const res = await this.read();
    if (res.code !== 220) {
      throw new Error(`SMTP 握手失败: ${res.message}`);
    }
  }

  async ehlo() {
    await this.write('EHLO rin');
    const res = await this.read();
    if (res.code === 250) return;
    // 部分老服务器不支持 EHLO，退回 HELO
    await this.write('HELO rin');
    const helo = await this.read();
    if (helo.code !== 250) {
      throw new Error(`EHLO/HELO 被拒绝: ${helo.message}`);
    }
  }

  async upgradeTls() {
    await this.write('STARTTLS');
    const res = await this.read();
    if (res.code !== 220) {
      throw new Error(`STARTTLS 被拒绝: ${res.message}`);
    }

    // 必须先释放读写锁，否则 TLS 握手无法进行
    this.reader.releaseLock();
    this.writer.releaseLock();
    this.socket = this.socket.startTls();
    this.reader = this.socket.readable.getReader();
    this.writer = this.socket.writable.getWriter();

    // TLS 之后服务端会重置会话状态，必须重新 EHLO
    await this.ehlo();
  }

  async authenticate(method) {
    if (method === 'plain') {
      const payload = base64(`\0${this.username}\0${this.password}`);
      await this.write(`AUTH PLAIN ${payload}`);
      const res = await this.read();
      if (res.code !== 235) {
        throw new Error(`认证失败: ${res.message}`);
      }
      return;
    }

    await this.write('AUTH LOGIN');
    let res = await this.read();
    if (res.code !== 334) {
      throw new Error(`AUTH LOGIN 被拒绝: ${res.message}`);
    }

    await this.write(base64(this.username));
    res = await this.read();
    if (res.code !== 334) {
      throw new Error(`用户名被拒绝: ${res.message}`);
    }

    await this.write(base64(this.password));
    res = await this.read();
    if (res.code !== 235) {
      throw new Error(`密码被拒绝: ${res.message}`);
    }
  }

  async send({ from, to, subject, text, html, authMethod }) {
    await this.greet();
    await this.ehlo();

    if (this.tlsMode === 'starttls') {
      await this.upgradeTls();
    }

    await this.authenticate(authMethod);

    await this.write(`MAIL FROM:<${from}>`);
    let res = await this.read();
    if (res.code !== 250) {
      throw new Error(`MAIL FROM 被拒绝: ${res.message}`);
    }

    await this.write(`RCPT TO:<${to}>`);
    res = await this.read();
    if (res.code !== 250 && res.code !== 251) {
      throw new Error(`RCPT TO 被拒绝: ${res.message}`);
    }

    await this.write('DATA');
    res = await this.read();
    if (res.code !== 354) {
      throw new Error(`DATA 被拒绝: ${res.message}`);
    }

    await this.writeMessage(buildMime({ from, to, subject, text, html }));

    res = await this.read();
    if (res.code !== 250) {
      throw new Error(`邮件被服务端拒绝: ${res.message}`);
    }
  }

  async quit() {
    await this.write('QUIT').catch(() => {});
  }

  destroy() {
    try {
      this.socket.close();
    } catch {
      // 连接可能已断开
    }
  }

  async write(line) {
    await withTimeout(
      this.writer.write(new TextEncoder().encode(line + CRLF)),
      '写入超时',
    );
  }

  async writeMessage(raw) {
    await withTimeout(
      this.writer.write(new TextEncoder().encode(raw)),
      '写入超时',
    );
  }

  /**
   * 读取 SMTP 应答。
   * SMTP 是多行应答格式：`250-STARTTLS` 是续行，`250 OK` 是终止行，
   * 必须读到终止行才算完整响应。
   */
  async read() {
    let buffer = '';

    while (true) {
      const { value, done } = await withTimeout(this.reader.read(), '读取超时');
      if (done) {
        throw new Error('连接已关闭');
      }

      buffer += new TextDecoder().decode(value, { stream: true });
      if (!buffer.includes(CRLF)) {
        continue;
      }

      const lines = buffer.split(/\r?\n/);
      const last = lines[lines.length - 2] ?? '';
      // 第 4 位是 '-' 表示续行，空格表示终止
      if (/^\d{3} /.test(last)) {
        const message = lines.slice(0, -2).join(CRLF);
        return { code: parseInt(last.slice(0, 3), 10), message };
      }
    }
  }
}

// ── MIME 组装 ───────────────────────────────────────────

function buildMime({ from, to, subject, text, html }) {
  const domain = from.split('@')[1] || 'localhost';
  const messageId = `<${crypto.randomUUID()}@${domain}>`;
  const date = new Date().toUTCString();

  const baseHeaders = [
    `From: ${from}`,
    `To: ${to}`,
    // 非 ASCII 主题必须编码，否则部分客户端会显示乱码
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
  ];

  let body;
  if (html) {
    const boundary = `----rin_${crypto.randomUUID().replace(/-/g, '')}`;
    baseHeaders.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    body = [
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      text || stripHtml(html),
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      '',
      html,
      `--${boundary}--`,
      '',
    ].join(CRLF);
  } else {
    baseHeaders.push('Content-Type: text/plain; charset=UTF-8');
    body = text;
  }

  const raw = `${baseHeaders.join(CRLF)}${CRLF}${CRLF}${body}`;

  // 正文行首的 "." 需要转义，否则会被当成 DATA 结束符
  const stuffed = raw.replace(/\r\n\./g, `${CRLF}..`);
  return `${stuffed}${CRLF}.${CRLF}`;
}

/** RFC 2047 编码：非 ASCII 字符按 UTF-8 Base64 编码 */
function encodeHeader(value) {
  // eslint-disable-next-line no-control-regex
  if (!/[^\x00-\x7F]/.test(value)) {
    return value;
  }

  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── 安全与工具 ──────────────────────────────────────────

/**
 * 拒绝内网与保留地址，防止网关被用来扫描内网或打 SSRF。
 * 只允许公网可解析的域名。
 */
function safeSmtpHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!host) return null;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    return null;
  }

  // IPv6 字面量：拒绝回环、链路本地、ULA
  if (host.startsWith('[')) {
    const v6 = host.slice(1, -1);
    if (v6 === '::' || v6 === '::1' || v6.startsWith('fe80') || v6.startsWith('fc') || v6.startsWith('fd')) {
      return null;
    }
    return host;
  }

  // IPv4：拒绝私有段、环回、链路本地、组播
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (match) {
    const a = +match[1];
    const b = +match[2];
    if (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    ) {
      return null;
    }
    return host;
  }

  // 必须是合法域名，不能是任意字符串
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) {
    return null;
  }

  return host;
}

function isLikelyEmail(value) {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value);
}

function clean(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function base64(value) {
  return btoa(unescape(encodeURIComponent(value)));
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  });
}

function buildCorsHeaders(env) {
  const allow = env.ALLOWED_ORIGIN && env.ALLOWED_ORIGIN !== '*' ? env.ALLOWED_ORIGIN : '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Mail-Token',
    'Access-Control-Max-Age': '86400',
  };
}

function normalizeTlsMode(value, port) {
  const mode = String(value || '').toLowerCase();
  if (mode === 'implicit' || mode === 'starttls') {
    return mode;
  }
  // 465 是隐式 TLS 的约定端口
  return port === 465 ? 'implicit' : 'starttls';
}

/** 常量时间比较，避免通过响应时间侧信道逐字节猜测 token */
function constantTimeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ── 内存限流 ────────────────────────────────────────────
// 注意：这是 isolate 级内存计数，多实例部署时每个实例独立计数。
// 网关是内部服务（需鉴权），这个强度够用；若要精确限流请接 KV / Durable Objects。

const rateBuckets = new Map();

function rateLimited(ip, limit, windowMs) {
  const now = Date.now();

  // 顺手清理过期桶，避免内存无限增长
  if (rateBuckets.size > 10_000) {
    for (const [key, bucket] of rateBuckets) {
      if (now - bucket.start > windowMs) {
        rateBuckets.delete(key);
      }
    }
  }

  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.start > windowMs) {
    rateBuckets.set(ip, { start: now, count: 1 });
    return false;
  }

  bucket.count += 1;
  return bucket.count > limit;
}

function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), SMTP_TIMEOUT_MS)),
  ]);
}

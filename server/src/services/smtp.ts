/**
 * 极简 SMTP 客户端（Cloudflare Workers / Node 双运行时）。
 * 不用现成库：Workers 没有 TCP 套接字，nodemailer 跑不起来，
 * 改用 `cloudflare:sockets` 显式支持 465 隐式 TLS 与 587 STARTTLS。
 * 不支持附件、连接池、CRAM-MD5、DKIM、DSN。
 */

export type SmtpConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  /** 发件人地址，同时作为 Message-ID 的域名来源 */
  from: string;
  /** 可选的显示名，最终拼成 `Name <addr@host>` */
  fromName?: string;
  /** 加密模式；不传时按端口推断（465 → implicit，其余 → starttls） */
  tlsMode?: 'implicit' | 'starttls';
  /** 兼容旧配置：true 表示 STARTTLS，false 表示明文。优先级低于 tlsMode */
  useStartTls?: boolean;
  /** AUTH 方式，默认 login；部分服务商只支持 plain */
  authMethod?: 'login' | 'plain';
};

export type SendMailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendMailResult = {
  /** SMTP 应答码，如 250 */
  code: number;
  message: string;
};

export class SmtpError extends Error {
  readonly code: number;

  constructor(message: string, code = 0) {
    super(message);
    this.name = "SmtpError";
    this.code = code;
  }
}

/**
 * `cloudflare:sockets` 只在 Workers 运行时存在，用动态 import 保证
 * 本模块在 Bun 等非 Workers 运行时下仍可加载、纯函数可正常单测。
 */
type SocketLike = {
  opened: Promise<unknown>;
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  /** 升级为 TLS。返回的是同一个 socket 的新句柄，且可能 reject。 */
  startTls(): Promise<SocketLike> | SocketLike;
  close(): Promise<void>;
};

/** 把 Workers 的 Socket 结构化适配成我们只依赖的那几个成员 */
function adaptSocket(socket: {
  opened: Promise<unknown>;
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  startTls(options?: unknown): unknown;
  close(): Promise<void>;
}): SocketLike {
  return socket as unknown as SocketLike;
}

async function openSmtpSocket(host: string, port: number, implicitTls: boolean): Promise<SocketLike> {
  type ConnectFn = (
    address: { hostname: string; port: number },
    options?: { secureTransport?: 'on' | 'off' | 'starttls'; allowHalfOpen?: boolean },
  ) => unknown;

  let connect: ConnectFn;

  try {
    const sockets = await import("cloudflare:sockets");
    connect = sockets.connect as unknown as ConnectFn;
  } catch {
    throw new SmtpError("cloudflare:sockets is unavailable in this runtime");
  }

  // 隐式 TLS（465）：连接建立时直接握手，服务端不会再发 STARTTLS 通知。
  // Cloudflare 在 connect() 的第二参数里支持这个模式。
  const raw = implicitTls
    ? connect({ hostname: host, port }, { secureTransport: 'on' })
    : connect({ hostname: host, port }, { secureTransport: 'off' });

  const socket = adaptSocket(raw as never);

  // `opened` 是一个会 reject 的 Promise：连接失败时必须显式 await 并转成 SmtpError，
  // 否则会变成未处理的 Promise 拒绝，把错误信号吞掉。
  try {
    await socket.opened;
  } catch (error) {
    const hint = implicitTls ? ' (implicit TLS on 465)' : '';
    throw new SmtpError(
      `Failed to open SMTP connection to ${host}:${port}${hint}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return socket;
}

/** 解析最终使用的 TLS 模式：显式 tlsMode 优先，其次旧开关，最后按端口推断 */
export function resolveTlsMode(config: Pick<SmtpConfig, 'port' | 'tlsMode' | 'useStartTls'>): 'implicit' | 'starttls' | 'plain' {
  if (config.tlsMode) {
    return config.tlsMode === 'implicit' ? 'implicit' : 'starttls';
  }

  if (config.useStartTls === false) {
    return 'plain';
  }

  // 465 是隐式 TLS 的约定端口；其余按 STARTTLS 处理
  return config.port === 465 ? 'implicit' : 'starttls';
}

const SMTP_TIMEOUT_MS = 15_000;

function formatAddress(address: string, name?: string) {
  if (!name) {
    return address;
  }
  return `${name} <${address}>`;
}

/**
 * 极简 MIME 邮件体。
 * Date / Message-ID 由这里生成，符合 RFC 5322 的基本要求。
 */
export function buildMimeMessage(options: SendMailOptions & { from: string; fromName?: string }): string {  const messageId = `<${crypto.randomUUID()}@${options.from.split("@")[1] || "localhost"}>`;
  const date = new Date().toUTCString();
  const boundary = `----rin_${crypto.randomUUID().replace(/-/g, "")}`;

  const headers = [
    `From: ${formatAddress(options.from, options.fromName)}`,
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    `MIME-Version: 1.0`,
  ];

  if (!options.html) {
    headers.push("Content-Type: text/plain; charset=UTF-8");
    return `${headers.join("\r\n")}\r\n\r\n${options.text}`;
  }

  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  const body = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    options.text,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    options.html,
    `--${boundary}--`,
  ].join("\r\n");

  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

/**
 * 逐行读取 SMTP 响应。
 * SMTP 可以返回多行应答（如 `250-STARTTLS` 续行，最后一行 `250 ...`），
 * 必须读到以空格开头的终止行才算完整。
 */
async function readResponse(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<{ code: number; message: string }> {
  const decoder = new TextDecoder();
  let buffer = "";
  let lastCode = 0;
  let lastMessage = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);

      if (!line) {
        continue;
      }

      const code = parseInt(line.slice(0, 3), 10);
      // `250-` 是续行，`250 ` 是终止行
      if (!Number.isNaN(code)) {
        lastCode = code;
        lastMessage = line.slice(4).trim();
        if (line[3] === " ") {
          return { code: lastCode, message: lastMessage };
        }
      } else {
        lastMessage = line.trim();
      }
    }
  }

  return { code: lastCode, message: lastMessage };
}

async function writeCommand(writer: WritableStreamDefaultWriter<Uint8Array>, command: string) {
  await writer.write(new TextEncoder().encode(`${command}\r\n`));
}

/**
 * 发送一封邮件。失败时抛 `SmtpError`，其 `code` 携带 SMTP 应答码便于定位。
 */
export async function sendMail(config: SmtpConfig, options: SendMailOptions): Promise<SendMailResult> {
  const { host, port, username, password } = config;
  const tlsMode = resolveTlsMode(config);
  const useStartTls = tlsMode === 'starttls';
  const authMethod = config.authMethod ?? 'login';

  let socket: SocketLike | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let writer: WritableStreamDefaultWriter<Uint8Array> | undefined;

  try {
    socket = await openSmtpSocket(host, port, tlsMode === 'implicit');

    reader = socket.readable.getReader();
    writer = socket.writable.getWriter();

    // greeting
    const greeting = await withTimeout(readResponse(reader), "SMTP greeting");
    if (greeting.code !== 220) {
      throw new SmtpError(`Unexpected SMTP greeting: ${greeting.message}`, greeting.code);
    }

    await withTimeout(writeCommand(writer, "EHLO rin"), "EHLO");
    const ehlo = await withTimeout(readResponse(reader), "EHLO response");
    if (ehlo.code !== 250) {
      throw new SmtpError(`EHLO rejected: ${ehlo.message}`, ehlo.code);
    }

    // 只有 STARTTLS 模式才需要显式升级；隐式 TLS 在连接时已完成
    if (useStartTls) {
      await withTimeout(writeCommand(writer, "STARTTLS"), "STARTTLS");
      const startTls = await withTimeout(readResponse(reader), "STARTTLS response");
      if (startTls.code !== 220) {
        throw new SmtpError(`STARTTLS rejected: ${startTls.message}`, startTls.code);
      }

      // 升级为 TLS：writer 必须先释放，否则 TLS 握手无法进行
      await writer.releaseLock();
      writer = undefined;
      await reader.cancel().catch(() => {});
      reader = undefined;

      const secure = adaptSocket(
        (await socket.startTls()) as Parameters<typeof adaptSocket>[0],
      );
      reader = secure.readable.getReader();
      writer = secure.writable.getWriter();

      // TLS 之后必须重新握手一次，服务端会重置会话状态
      await withTimeout(writeCommand(writer, "EHLO rin"), "EHLO after STARTTLS");
      const ehloSecure = await withTimeout(readResponse(reader), "EHLO response after STARTTLS");
      if (ehloSecure.code !== 250) {
        throw new SmtpError(`EHLO after STARTTLS rejected: ${ehloSecure.message}`, ehloSecure.code);
      }
    }

    if (username) {
      if (authMethod === 'plain') {
        // AUTH PLAIN 一次性发送 base64(\0user\0pass)，没有多轮往返
        const credentials = base64(`\0${username}\0${password}`);
        await withTimeout(writeCommand(writer, `AUTH PLAIN ${credentials}`), "AUTH PLAIN");
        const authPlain = await withTimeout(readResponse(reader), "AUTH PLAIN response");
        if (authPlain.code !== 235) {
          throw new SmtpError(`AUTH PLAIN rejected: ${authPlain.message}`, authPlain.code);
        }
      } else {
        await withTimeout(writeCommand(writer, "AUTH LOGIN"), "AUTH LOGIN");
        const authStart = await withTimeout(readResponse(reader), "AUTH LOGIN response");
        if (authStart.code !== 334) {
          throw new SmtpError(`AUTH LOGIN rejected: ${authStart.message}`, authStart.code);
        }

        await withTimeout(writeCommand(writer, base64(username)), "AUTH username");
        const authUser = await withTimeout(readResponse(reader), "AUTH username response");
        if (authUser.code !== 334) {
          throw new SmtpError(`SMTP username rejected: ${authUser.message}`, authUser.code);
        }

        await withTimeout(writeCommand(writer, base64(password)), "AUTH password");
        const authPass = await withTimeout(readResponse(reader), "AUTH password response");
        if (authPass.code !== 235) {
          throw new SmtpError(`SMTP password rejected: ${authPass.message}`, authPass.code);
        }
      }
    }

    await withTimeout(writeCommand(writer, `MAIL FROM:<${config.from}>`), "MAIL FROM");
    const mailFrom = await withTimeout(readResponse(reader), "MAIL FROM response");
    if (mailFrom.code !== 250) {
      throw new SmtpError(`MAIL FROM rejected: ${mailFrom.message}`, mailFrom.code);
    }

    await withTimeout(writeCommand(writer, `RCPT TO:<${options.to}>`), "RCPT TO");
    const rcptTo = await withTimeout(readResponse(reader), "RCPT TO response");
    if (rcptTo.code !== 250 && rcptTo.code !== 251) {
      throw new SmtpError(`RCPT TO rejected: ${rcptTo.message}`, rcptTo.code);
    }

    await withTimeout(writeCommand(writer, "DATA"), "DATA");
    const dataReady = await withTimeout(readResponse(reader), "DATA response");
    if (dataReady.code !== 354) {
      throw new SmtpError(`DATA rejected: ${dataReady.message}`, dataReady.code);
    }

    const message = buildMimeMessage({ ...options, from: config.from, fromName: config.fromName });
    // 正文行首的 "." 需要转义，否则会被当成 DATA 结束符
    const payload = message.replace(/\r\n\./g, "\r\n..");
    await withTimeout(writer.write(new TextEncoder().encode(`${payload}\r\n.\r\n`)), "message body");

    const sent = await withTimeout(readResponse(reader), "final response");
    if (sent.code !== 250) {
      throw new SmtpError(`Message rejected: ${sent.message}`, sent.code);
    }

    await withTimeout(writeCommand(writer, "QUIT"), "QUIT").catch(() => {});

    return { code: sent.code, message: sent.message };
  } finally {
    // 无论成败都要释放锁并关闭连接，避免连接泄漏。
    // releaseLock 返回 void，不能链式 catch。
    if (writer) {
      try {
        writer.releaseLock();
      } catch {
        // 已释放或流已关闭，忽略
      }
    }
    if (reader) {
      await reader.cancel().catch(() => {});
    }
    if (socket) {
      await socket.close().catch(() => {});
    }
  }
}

function base64(value: string) {
  return btoa(unescape(encodeURIComponent(value)));
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new SmtpError(`SMTP timeout during ${label}`)), SMTP_TIMEOUT_MS),
    ),
  ]);
}

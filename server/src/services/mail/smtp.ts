import { sendMail, SmtpError, type SmtpConfig } from '../smtp';
import { MailDeliveryError, type MailMessage, type MailProvider } from './types';

/**
 * SMTP 直连 Provider。
 *
 * 把 `smtp.ts` 的协议实现包成统一接口，异常在此翻译成 `MailDeliveryError`，
 * 让上层（注册流程）不必区分 SMTP 错误和 HTTP 网关错误。
 */
export function createSmtpMailProvider(config: SmtpConfig): MailProvider {
  return {
    kind: 'smtp',

    describe() {
      return `smtp via ${config.host}:${config.port}`;
    },

    async send(message: MailMessage) {
      try {
        await sendMail(config, {
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
      } catch (error) {
        if (error instanceof SmtpError) {
          // 保留 SMTP 应答码：550/553 等能直接定位是发件人/收件人被拒还是认证失败
          throw new MailDeliveryError('smtp', error.message);
        }

        throw new MailDeliveryError(
          'smtp',
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  };
}

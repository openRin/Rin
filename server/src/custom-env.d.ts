import type { QueueTask } from "./queue";

declare global {
  interface Env {
    TASK_QUEUE?: Queue<QueueTask>;
    R2_BUCKET?: R2Bucket;
    /** 站点公开访问地址（可选）。未设置时 sitemap/robots 回退到请求来源 origin */
    FRONTEND_URL?: string;

    /**
     * 对象存储后端选择：r2 / s3 / supabase。
     * 留空时按配置自动探测（有 Supabase 配置 → supabase，有 R2 binding → r2，否则 s3）。
     */
    STORAGE_PROVIDER?: string;

    /** Supabase Storage：项目地址，如 https://xxxx.supabase.co */
    SUPABASE_URL?: string;
    /**
     * Supabase Storage：高权限 key，绕过 RLS，可读写私有 bucket。
     * 推荐 sb_secret_...（新版）；也接受 legacy service_role（eyJ 开头的 JWT）。
     * 部署时作为 Worker Secret 注入。旧名 SUPABASE_SERVICE_ROLE_KEY 仍兼容。
     */
    SUPABASE_SECRET_KEY?: string;
    /** @deprecated 旧变量名，请改用 SUPABASE_SECRET_KEY */
    SUPABASE_SERVICE_ROLE_KEY?: string;
    /** Supabase Storage：storage bucket 名 */
    SUPABASE_STORAGE_BUCKET?: string;
    /** Supabase Storage：bucket 是否为公开桶。公开桶直链由 Supabase 直接服务，否则走 /api/blob 反代 */
    SUPABASE_STORAGE_PUBLIC?: string;
  }
}

export {};
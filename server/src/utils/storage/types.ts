/**
 * 对象存储抽象层。支持 R2 binding、任意 S3 兼容服务、Supabase Storage，
 * 业务层只依赖 `ObjectStorage` 接口，不感知具体后端。
 */

export type StorageProviderKind = "r2" | "s3" | "supabase";

export type StorageBody = Blob | ArrayBuffer | Uint8Array | string;

/** 对象存储后端契约。所有方法以「完整存储键」寻址，folder 拼接由 storage.ts 门面负责 */
export interface ObjectStorage {
    /** 后端标识，用于日志、健康检查与测试断言 */
    readonly kind: StorageProviderKind;
    /** 读取对象；对象不存在时返回 null */
    get(storageKey: string): Promise<Response | null>;
    /** 读取对象元信息；对象不存在时返回 null */
    head(storageKey: string): Promise<Response | null>;
    /** 写入对象，同键覆盖 */
    put(storageKey: string, body: StorageBody, contentType?: string): Promise<void>;
    /** 生成对外可访问URL */
    publicUrl(storageKey: string, baseUrl?: string): string;
}

export function trimTrailingSlash(value: string) {
    return value.endsWith("/") ? value.slice(0, -1) : value;
}

/** 分段编码存储键，用于 `/api/blob/*` 反代 URL；blob 路由会还原后再交给 provider */
export function encodeStorageKey(key: string) {
    return key
        .split("/")
        .filter((segment) => segment.length > 0)
        .map((segment) => encodeURIComponent(segment))
        .join("/");
}

/**
 * 编码对象键的路径段，用于拼接后端请求 URL。
 * `.` / `..` 段必须直接丢弃：编码后 `new URL()` 仍会还原并做路径规范化，
 * 导致逃出 bucket 前缀。Rin 的对象键本身不含这些段，丢弃是安全的。
 */
export function encodeObjectKey(key: string) {
    return key
        .split("/")
        .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
}

/** 构造经 Worker 反代的 blob URL */
export function buildBlobUrl(storageKey: string, baseUrl?: string) {
    const path = `/api/blob/${encodeStorageKey(storageKey)}`;

    if (!baseUrl) {
        return path;
    }

    return `${trimTrailingSlash(baseUrl)}${path}`;
}

/** 缺配置时统一抛 `XXX is not defined`；services/storage.ts 依赖该子串映射为 500 */
export function missingConfig(name: string): never {
    throw new Error(`${name} is not defined`);
}
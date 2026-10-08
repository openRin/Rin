import { path_join } from "./path";
import { resolveStorageProvider } from "./storage/resolve";
import { buildBlobUrl, type StorageBody } from "./storage/types";

/** 对象存储门面。业务层只调用这里的函数，具体后端由 `resolveStorageProvider` 按配置选择 */

/** 解析上传目标并返回 folder 前缀。同时承担校验配置职责：缺配置时抛 `XXX is not defined` */
export function resolveStorageTarget(env: Env) {
    const storage = resolveStorageProvider(env);
    return {
        kind: storage.kind,
        folder: env.S3_FOLDER || "",
    };
}

export async function getStorageObject(env: Env, storageKey: string): Promise<Response | null> {
    return resolveStorageProvider(env).get(storageKey);
}

export async function headStorageObject(env: Env, storageKey: string): Promise<Response | null> {
    return resolveStorageProvider(env).head(storageKey);
}

export function getStoragePublicUrl(env: Env, storageKey: string, baseUrl?: string) {
    return resolveStorageProvider(env).publicUrl(storageKey, baseUrl);
}

export async function putStorageObject(
    env: Env,
    key: string,
    body: StorageBody,
    contentType?: string,
    baseUrl?: string,
) {
    const target = resolveStorageTarget(env);
    const storageKey = path_join(target.folder, key);

    return putStorageObjectAtKey(env, storageKey, body, contentType, baseUrl);
}

export async function putStorageObjectAtKey(
    env: Env,
    storageKey: string,
    body: StorageBody,
    contentType?: string,
    baseUrl?: string,
) {
    const storage = resolveStorageProvider(env);
    await storage.put(storageKey, body, contentType);

    return {
        key: storageKey,
        url: storage.publicUrl(storageKey, baseUrl),
    };
}

export { buildBlobUrl };
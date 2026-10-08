export { R2ObjectStorage, createR2ObjectStorage } from "./r2";
export { S3ObjectStorage, createS3ObjectStorage } from "./s3";
export { SupabaseObjectStorage, createSupabaseObjectStorage } from "./supabase";
export { detectStorageProviderKind, resolveStorageProvider } from "./resolve";
export {
    buildBlobUrl,
    encodeStorageKey,
    trimTrailingSlash,
    type ObjectStorage,
    type StorageBody,
    type StorageProviderKind,
} from "./types";
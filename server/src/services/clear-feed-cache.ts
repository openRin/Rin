import type { CacheImpl } from "../core/hono-types";

export async function clearFeedCache(cache: CacheImpl, id: number, alias: string | null, newAlias: string | null) {
    await cache.deletePrefix('feeds_');
    await cache.deletePrefix('search_');

    const detailKeys = new Set([`feed_${id}`]);
    if (alias) detailKeys.add(`feed_${alias}`);
    if (newAlias && newAlias !== alias) detailKeys.add(`feed_${newAlias}`);

    for (const key of detailKeys) {
        await cache.delete(key, false);
    }

    await cache.deletePrefix(`${id}_previous_feed`);
    await cache.deletePrefix(`${id}_next_feed`);
    await cache.save();
}

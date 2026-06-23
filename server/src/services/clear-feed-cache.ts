import type { CacheImpl } from "../core/hono-types";

export async function clearFeedCache(cache: CacheImpl, id: number, alias: string | null, newAlias: string | null) {
    await cache.deletePrefix('feeds_');
    await cache.deletePrefix('search_');

    const detailKeys = new Set([`feed_${id}`, `feed_id_${id}`]);
    if (alias) {
        detailKeys.add(`feed_${alias}`);
        detailKeys.add(`feed_alias_${alias}`);
    }
    if (newAlias && newAlias !== alias) {
        detailKeys.add(`feed_${newAlias}`);
        detailKeys.add(`feed_alias_${newAlias}`);
    }

    for (const key of detailKeys) {
        await cache.delete(key, false);
    }

    await cache.deletePrefix(`${id}_previous_feed`);
    await cache.deletePrefix(`${id}_next_feed`);
    await cache.save();
}

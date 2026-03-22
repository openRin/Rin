type FeedCache = {
    deletePrefix(prefix: string): Promise<void>;
    delete(key: string, save?: boolean): Promise<void>;
};

export async function clearFeedCache(cache: FeedCache, id: number, alias: string | null, newAlias: string | null) {
    await cache.deletePrefix('feeds_');
    await cache.deletePrefix('search_');
    await cache.delete(`feed_${id}`, false);
    await cache.deletePrefix(`${id}_previous_feed`);
    await cache.deletePrefix(`${id}_next_feed`);
    if (alias) await cache.delete(`feed_${alias}`, false);
    if (newAlias && newAlias !== alias) await cache.delete(`feed_${newAlias}`, false);
}

import { describe, expect, it } from 'bun:test';

import { clearFeedCache } from '../clear-feed-cache';

describe('clearFeedCache', () => {
    it('deletes alias cache when alias is unchanged', async () => {
        const deletedPrefixes: string[] = [];
        const deletedKeys: Array<{ key: string; save: boolean | undefined }> = [];
        const cache = {
            async deletePrefix(prefix: string) {
                deletedPrefixes.push(prefix);
            },
            async delete(key: string, save?: boolean) {
                deletedKeys.push({ key, save });
            }
        } as any;

        await clearFeedCache(cache, 42, 'about', 'about');

        expect(deletedPrefixes).toEqual([
            'feeds_',
            'search_',
            '42_previous_feed',
            '42_next_feed'
        ]);
        expect(deletedKeys).toEqual([
            { key: 'feed_42', save: false },
            { key: 'feed_about', save: false }
        ]);
    });

    it('deletes both old and new alias cache keys when alias changes', async () => {
        const deletedKeys: Array<{ key: string; save: boolean | undefined }> = [];
        const cache = {
            async deletePrefix() {},
            async delete(key: string, save?: boolean) {
                deletedKeys.push({ key, save });
            }
        } as any;

        await clearFeedCache(cache, 42, 'about', 'about-us');

        expect(deletedKeys).toEqual([
            { key: 'feed_42', save: false },
            { key: 'feed_about', save: false },
            { key: 'feed_about-us', save: false }
        ]);
    });
});

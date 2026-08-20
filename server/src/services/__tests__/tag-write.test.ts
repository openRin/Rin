import { afterEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { createMockDB } from "../../../tests/fixtures";
import { feedHashtags, feeds, hashtags, users } from "../../db/schema";
import { bindTagToPost } from "../tag";

describe("bindTagToPost", () => {
    const databases: Array<ReturnType<typeof createMockDB>> = [];

    afterEach(() => {
        while (databases.length > 0) {
            databases.pop()?.sqlite.close();
        }
    });

    it("normalizes duplicate tags and writes relations as one set", async () => {
        const context = createMockDB();
        databases.push(context);
        await context.db.insert(users).values({ username: "admin", openid: "admin" });
        const [feed] = await context.db.insert(feeds)
            .values({ title: "Post", content: "Content", uid: 1, draft: 0, listed: 1 })
            .returning({ id: feeds.id });

        await bindTagToPost(context.db as any, feed.id, [" TypeScript ", "TypeScript", "Bun"]);

        const storedTags = await context.db.select().from(hashtags);
        const relations = await context.db.select().from(feedHashtags)
            .where(eq(feedHashtags.feedId, feed.id));

        expect(storedTags.map((tag) => tag.name).sort()).toEqual(["Bun", "TypeScript"]);
        expect(relations).toHaveLength(2);
    });
});

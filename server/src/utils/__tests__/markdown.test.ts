import { describe, expect, it } from 'bun:test';
import { stripMarkdown } from '../markdown';

describe('stripMarkdown', () => {
    it('removes media and code from summary text', () => {
        const result = stripMarkdown([
            '# Title',
            '<iframe src="https://example.com/embed"></iframe>',
            '```ts',
            'const hidden = true;',
            '```',
            '![cover](https://example.com/cover.png)',
            '[Read more](https://example.com)',
        ].join('\n'));

        expect(result).toContain('Title');
        expect(result).toContain('Read more');
        expect(result).not.toContain('iframe');
        expect(result).not.toContain('hidden');
        expect(result).not.toContain('cover.png');
    });

    it('strips task markers before generic list markers', () => {
        expect(stripMarkdown('- [x] Done\n- [ ] Todo')).toBe('Done\nTodo');
    });
});

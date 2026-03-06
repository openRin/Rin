import { describe, it, expect } from 'bun:test';
import { extractImage, stripImageMetadataFromUrl } from '../image';

describe('extractImage', () => {
    it('should extract image URL from markdown', () => {
        const content = '# Title\n\n![alt text](https://example.com/image.png)\n\nSome content';
        const result = extractImage(content);
        expect(result).toBe('https://example.com/image.png');
    });

    it('should return undefined when no image', () => {
        const content = '# Title\n\nSome content without image';
        const result = extractImage(content);
        expect(result).toBeUndefined();
    });

    it('should extract first image only', () => {
        const content = '![first](https://first.png)\n\n![second](https://second.png)';
        const result = extractImage(content);
        expect(result).toBe('https://first.png');
    });

    it('should handle empty string', () => {
        const result = extractImage('');
        expect(result).toBeUndefined();
    });

    it('should handle image with special characters in alt', () => {
        const content = '![alt with spaces and $pecial chars](https://img.png)';
        const result = extractImage(content);
        expect(result).toBe('https://img.png');
    });

    it('should handle relative image paths', () => {
        const content = '![local](./images/photo.jpg)';
        const result = extractImage(content);
        expect(result).toBe('./images/photo.jpg');
    });

    it('should strip blurhash metadata from image URL fragments', () => {
        const content = '![alt](https://example.com/image.png#blurhash=LEHV6nWB2yk8pyo0adR*.7kCMdnj)';
        const result = extractImage(content);
        expect(result).toBe('https://example.com/image.png');
    });
});

describe('stripImageMetadataFromUrl', () => {
    it('should remove fragment metadata from image URLs', () => {
        expect(stripImageMetadataFromUrl('https://example.com/image.png#blurhash=test')).toBe('https://example.com/image.png');
    });

    it('should keep plain image URLs unchanged', () => {
        expect(stripImageMetadataFromUrl('https://example.com/image.png')).toBe('https://example.com/image.png');
    });
});

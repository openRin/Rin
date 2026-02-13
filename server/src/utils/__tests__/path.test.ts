import { describe, it, expect } from 'bun:test';
import { path_join, getFirstPathSegment } from '../path';

describe('path_join', () => {
    it('should join simple paths', () => {
        expect(path_join('a', 'b', 'c')).toBe('a/b/c');
    });

    it('should handle leading slashes', () => {
        expect(path_join('/a', 'b')).toBe('/a/b');
    });

    it('should handle trailing slashes', () => {
        expect(path_join('a/', 'b/')).toBe('a/b');
    });

    it('should handle empty strings', () => {
        expect(path_join('', 'a', '')).toBe('a');
    });

    it('should handle relative paths with dots', () => {
        expect(path_join('a', './b')).toBe('a/b');
    });

    it('should handle parent directory references', () => {
        expect(path_join('a/b', '../c')).toBe('a/c');
    });

    it('should handle multiple slashes', () => {
        expect(path_join('a//b', 'c')).toBe('a/b/c');
    });

    it('should return root for absolute path with all parent references', () => {
        expect(path_join('/a/b', '..', '..')).toBe('/');
    });

    it('should handle single path', () => {
        expect(path_join('single')).toBe('single');
    });

    it('should return dot for empty paths', () => {
        expect(path_join('')).toBe('.');
    });
});

describe('getFirstPathSegment', () => {
    it('should extract first segment from full URL', () => {
        expect(getFirstPathSegment('https://example.com/api/users/123')).toBe('api');
    });

    it('should handle root URL', () => {
        expect(getFirstPathSegment('https://example.com/')).toBe('');
    });

    it('should handle URL without protocol', () => {
        expect(getFirstPathSegment('/api/users/123')).toBe('api');
    });

    it('should handle relative path', () => {
        expect(getFirstPathSegment('relative/path/to/resource')).toBe('relative');
    });

    it('should handle URL with query string', () => {
        expect(getFirstPathSegment('/api/users?id=123')).toBe('api');
    });

    it('should handle URL with hash', () => {
        expect(getFirstPathSegment('/api/users#section')).toBe('api');
    });

    it('should decode URL-encoded segments', () => {
        expect(getFirstPathSegment('/api%20test/path')).toBe('api test');
    });

    it('should return empty string for empty path', () => {
        expect(getFirstPathSegment('')).toBe('');
    });

    it('should return empty string for domain only', () => {
        expect(getFirstPathSegment('https://example.com')).toBe('');
    });
});
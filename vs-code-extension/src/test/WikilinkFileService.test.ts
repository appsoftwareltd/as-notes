import { describe, it, expect } from 'vitest';
import { getPathDistance } from '../PathUtils.js';

describe('getPathDistance', () => {
    it('should return 0 for same directory', () => {
        expect(getPathDistance('notes', 'notes')).toBe(0);
    });

    it('should return 0 for root vs root', () => {
        expect(getPathDistance('.', '.')).toBe(0);
    });

    it('should return 1 for parent to child', () => {
        expect(getPathDistance('notes', 'notes/sub')).toBe(1);
    });

    it('should return 1 for child to parent', () => {
        expect(getPathDistance('notes/sub', 'notes')).toBe(1);
    });

    it('should return 2 for sibling directories', () => {
        // notes/a → notes (up 1) → notes/b (down 1) = 2
        expect(getPathDistance('notes/a', 'notes/b')).toBe(2);
    });

    it('should return 3 for root to deeply nested', () => {
        expect(getPathDistance('.', 'deep/nested/dir')).toBe(3);
    });

    it('should return correct distance for complex paths', () => {
        // a/b/c → a/b (up 1) → a (up 1) → a/x (down 1) → a/x/y (down 1) = 4
        expect(getPathDistance('a/b/c', 'a/x/y')).toBe(4);
    });

    it('should handle case-insensitive comparison', () => {
        expect(getPathDistance('Notes/Sub', 'notes/sub')).toBe(0);
    });

    it('should return correct distance for completely different trees', () => {
        // a/b → . (up 2) → x/y (down 2) = 4
        expect(getPathDistance('a/b', 'x/y')).toBe(4);
    });

    it('should handle deeply nested same prefix', () => {
        // a/b/c/d → a/b/c (up 1) = 1
        expect(getPathDistance('a/b/c/d', 'a/b/c')).toBe(1);
    });
});

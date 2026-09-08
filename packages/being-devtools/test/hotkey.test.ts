import { describe, expect, it } from 'vitest';

import { matchesHotkey, parseHotkey } from '../src/hotkey';

function key(overrides: Partial<Parameters<typeof matchesHotkey>[0]>) {
    return {
        key: 'm',
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        ...overrides,
    };
}

describe('parseHotkey', () => {
    it('parses modifiers and a key, case-insensitively', () => {
        expect(parseHotkey('Ctrl+Shift+M')).toEqual({
            ctrl: true,
            shift: true,
            alt: false,
            key: 'm',
        });
    });

    it('treats cmd and meta as ctrl', () => {
        expect(parseHotkey('cmd+k').ctrl).toBe(true);
        expect(parseHotkey('meta+k').ctrl).toBe(true);
    });

    it('rejects a spec with no key', () => {
        expect(() => parseHotkey('ctrl+shift')).toThrow(/no key/);
    });

    it('rejects a spec with two keys', () => {
        expect(() => parseHotkey('ctrl+m+k')).toThrow(/more than one key/);
    });
});

describe('matchesHotkey', () => {
    const hotkey = parseHotkey('ctrl+shift+m');

    it('matches with ctrl held', () => {
        expect(
            matchesHotkey(key({ ctrlKey: true, shiftKey: true }), hotkey)
        ).toBe(true);
    });

    it('matches with meta held instead of ctrl (macOS)', () => {
        expect(
            matchesHotkey(key({ metaKey: true, shiftKey: true }), hotkey)
        ).toBe(true);
    });

    it('matches the shifted uppercase key the browser reports', () => {
        expect(
            matchesHotkey(
                key({ key: 'M', ctrlKey: true, shiftKey: true }),
                hotkey
            )
        ).toBe(true);
    });

    it('rejects when a required modifier is missing', () => {
        expect(matchesHotkey(key({ ctrlKey: true }), hotkey)).toBe(false);
    });

    it('rejects when an extra modifier is held', () => {
        expect(
            matchesHotkey(
                key({ ctrlKey: true, shiftKey: true, altKey: true }),
                hotkey
            )
        ).toBe(false);
    });

    it('rejects a different key', () => {
        expect(
            matchesHotkey(
                key({ key: 'k', ctrlKey: true, shiftKey: true }),
                hotkey
            )
        ).toBe(false);
    });
});

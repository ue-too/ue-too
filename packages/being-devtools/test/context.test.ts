import { describe, expect, it } from 'vitest';

import { MAX_CONTEXT_CHARS, serializeContext } from '../src/context';

describe('serializeContext', () => {
    it('returns an empty string for nothing', () => {
        expect(serializeContext(undefined)).toBe('');
        expect(serializeContext(null)).toBe('');
    });

    it('pretty-prints and strips functions', () => {
        const text = serializeContext({
            balance: 100,
            setup() {},
        });
        expect(text).toBe('{\n  "balance": 100\n}');
    });

    it('marks circular references instead of throwing', () => {
        const context: Record<string, unknown> = { name: 'loop' };
        context.self = context;
        expect(serializeContext(context)).toContain('"self": "[circular]"');
    });

    it('truncates at the cap with an ellipsis line', () => {
        const context = { big: 'x'.repeat(MAX_CONTEXT_CHARS * 2) };
        const text = serializeContext(context);
        expect(text.endsWith('\n…')).toBe(true);
        expect(text.length).toBe(MAX_CONTEXT_CHARS + 2);
    });

    it('honours a custom cap', () => {
        expect(serializeContext({ a: 'bbbbbbbb' }, 5)).toBe('{\n  "\n…');
    });

    it('reports unserializable values', () => {
        expect(serializeContext({ n: BigInt(1) })).toBe(
            '(context not serializable)'
        );
    });
});

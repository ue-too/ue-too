import { NullJockey } from '../src/ai';

describe('NullJockey', () => {
    it('infer returns an empty map', () => {
        const jockey = new NullJockey();
        // NullJockey.infer ignores its argument entirely
        const result = jockey.infer(null as any);
        expect(result).toBeInstanceOf(Map);
        expect(result.size).toBe(0);
    });

    it('dispose is a no-op', () => {
        const jockey = new NullJockey();
        expect(() => jockey.dispose()).not.toThrow();
    });
});

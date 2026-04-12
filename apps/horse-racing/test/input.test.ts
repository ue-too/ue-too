/**
 * Bun's test runner runs without a DOM by default.  The input handler
 * uses `window.addEventListener`, so we polyfill a minimal EventTarget
 * as `globalThis.window` when it doesn't already exist (CI).
 */
if (typeof globalThis.window === 'undefined') {
    const et = new EventTarget();
    // @ts-expect-error — intentionally minimal shim
    globalThis.window = et as Window & typeof globalThis;
    // KeyboardEvent also needs to exist
    if (typeof globalThis.KeyboardEvent === 'undefined') {
        // @ts-expect-error — minimal shim
        globalThis.KeyboardEvent = class KeyboardEvent extends Event {
            key: string;
            constructor(type: string, init?: { key?: string }) {
                super(type);
                this.key = init?.key ?? '';
            }
        };
    }
}

import { createInputHandler } from '../src/simulation/input';

function press(key: string) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}
function release(key: string) {
    window.dispatchEvent(new KeyboardEvent('keyup', { key }));
}

describe('createInputHandler', () => {
    it('starts at zero', () => {
        const h = createInputHandler();
        expect(h.state).toEqual({ tangential: 0, normal: 0 });
        h.dispose();
    });

    it('maps ArrowUp / ArrowDown to tangential +1 / -1', () => {
        const h = createInputHandler();
        press('ArrowUp');
        expect(h.state.tangential).toBe(1);
        release('ArrowUp');
        expect(h.state.tangential).toBe(0);
        press('ArrowDown');
        expect(h.state.tangential).toBe(-1);
        release('ArrowDown');
        h.dispose();
    });

    it('maps ArrowRight / ArrowLeft to normal +1 / -1', () => {
        const h = createInputHandler();
        press('ArrowRight');
        expect(h.state.normal).toBe(1);
        release('ArrowRight');
        press('ArrowLeft');
        expect(h.state.normal).toBe(-1);
        release('ArrowLeft');
        h.dispose();
    });

    it('opposing keys cancel to zero', () => {
        const h = createInputHandler();
        press('ArrowLeft');
        press('ArrowRight');
        expect(h.state.normal).toBe(0);
        release('ArrowLeft');
        release('ArrowRight');
        h.dispose();
    });

    it('dispose removes listeners', () => {
        const h = createInputHandler();
        h.dispose();
        press('ArrowUp');
        expect(h.state.tangential).toBe(0);
    });
});

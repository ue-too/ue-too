import { createInputHandler } from '../../src/simulation/v2/input';

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

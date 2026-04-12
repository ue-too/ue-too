import type { InputState } from './types';

const TRACKED_KEYS = new Set([
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
]);

/**
 * Global keyboard listener that feeds a tri-state `InputState` ref.
 * Callers pass the returned `state` object to `race.tick()` each frame.
 * Opposing keys cancel (holding Left + Right → 0). Arrow-key defaults
 * (page scroll) are suppressed via `preventDefault`.
 */
export function createInputHandler(): {
    state: InputState;
    dispose: () => void;
} {
    const state: InputState = { tangential: 0, normal: 0 };
    const pressed = new Set<string>();

    const refresh = () => {
        const up = pressed.has('ArrowUp');
        const down = pressed.has('ArrowDown');
        state.tangential = up === down ? 0 : up ? 1 : -1;
        const right = pressed.has('ArrowRight');
        const left = pressed.has('ArrowLeft');
        state.normal = right === left ? 0 : right ? 1 : -1;
    };

    const onDown = (e: KeyboardEvent) => {
        if (!TRACKED_KEYS.has(e.key)) return;
        e.preventDefault();
        pressed.add(e.key);
        refresh();
    };

    const onUp = (e: KeyboardEvent) => {
        if (!TRACKED_KEYS.has(e.key)) return;
        pressed.delete(e.key);
        refresh();
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);

    return {
        state,
        dispose: () => {
            window.removeEventListener('keydown', onDown);
            window.removeEventListener('keyup', onUp);
        },
    };
}

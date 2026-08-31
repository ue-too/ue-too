import { describe, expect, it } from 'vitest';

import Board from '../../src/boardify';
import { VanillaKMTEventParser } from '../../src/input-interpretation/raw-input-parser';

// Board's CanvasProxy constructs ResizeObserver/IntersectionObserver/MutationObserver
// eagerly. With no canvas they never observe anything, so no-op stubs suffice to let
// Board instantiate in a DOM-free test runner.
class NoopObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): unknown[] {
        return [];
    }
}
globalThis.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??=
    NoopObserver as unknown as typeof IntersectionObserver;
globalThis.MutationObserver ??=
    NoopObserver as unknown as typeof MutationObserver;

describe('Board state machine getters', () => {
    it('exposes the kmt input state machine the parser holds', () => {
        const board = new Board();
        expect(board.kmtInputStateMachine).toBeDefined();
        expect(board.kmtInputStateMachine).toBe(board.kmtParser.stateMachine);
    });

    it('exposes the touch input state machine the parser holds', () => {
        const board = new Board();
        expect(board.touchInputStateMachine).toBeDefined();
        expect(board.touchInputStateMachine).toBe(
            board.touchParser.stateMachine
        );
    });

    it('the kmt machine starts in IDLE and responds to spacebarDown', () => {
        const board = new Board();
        const machine = board.kmtInputStateMachine!;
        expect(machine.currentState).toBe('IDLE');
        machine.happens('spacebarDown');
        expect(machine.currentState).toBe('READY_TO_PAN_VIA_SPACEBAR');
    });

    it('follows a swapped parser rather than caching the original machine', () => {
        const board = new Board();
        const original = board.kmtInputStateMachine;
        const replacement = { happens: () => ({ handled: false as const }) };
        // The parser's addEventListeners returns early when it has no canvas,
        // so the setter's tearDown/setUp cycle is safe in a DOM-free runner.
        board.kmtParser = new VanillaKMTEventParser(
            replacement,
            board.inputOrchestrator
        );
        expect(board.kmtInputStateMachine).not.toBe(original);
        expect(board.kmtInputStateMachine).toBe(replacement);
    });
});

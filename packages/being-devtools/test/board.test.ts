import { describe, expect, it } from 'vitest';

import {
    KMT_SAMPLE_PAYLOADS,
    TOUCH_SAMPLE_PAYLOADS,
    resolveBoardMachines,
} from '../src/board';

function fakeMachine(tag: string) {
    return {
        tag,
        happens: () => ({ handled: false }),
        currentState: 'IDLE',
        states: {},
        possibleStates: [],
        reset() {},
    };
}

function fullBoard() {
    return {
        kmtInputStateMachine: fakeMachine('kmt'),
        touchInputStateMachine: fakeMachine('touch'),
        cameraMux: {
            panStateMachine: fakeMachine('pan'),
            zoomStateMachine: fakeMachine('zoom'),
            rotateStateMachine: fakeMachine('rotate'),
        },
    };
}

describe('resolveBoardMachines', () => {
    it('finds all five machines with prefixed names and payloads', () => {
        const entries = resolveBoardMachines(fullBoard());
        expect(entries.map(e => e.name)).toEqual([
            'board:kmt-input',
            'board:touch-input',
            'board:pan-control',
            'board:zoom-control',
            'board:rotation-control',
        ]);
        expect(entries[0].samplePayloads).toBe(KMT_SAMPLE_PAYLOADS);
        expect(entries[1].samplePayloads).toBe(TOUCH_SAMPLE_PAYLOADS);
        expect(entries[2].samplePayloads).toEqual({});
        expect((entries[4].machine as unknown as { tag: string }).tag).toBe(
            'rotate'
        );
    });

    it('honours a custom prefix', () => {
        const entries = resolveBoardMachines(fullBoard(), 'minimap');
        expect(entries[0].name).toBe('minimap:kmt-input');
    });

    it('skips a parser that exposes no machine', () => {
        const board = fullBoard();
        board.touchInputStateMachine = undefined as never;
        expect(resolveBoardMachines(board).map(e => e.name)).toEqual([
            'board:kmt-input',
            'board:pan-control',
            'board:zoom-control',
            'board:rotation-control',
        ]);
    });

    it('skips a mux without the machine getters', () => {
        const board = { ...fullBoard(), cameraMux: { notAMachine: true } };
        expect(resolveBoardMachines(board).map(e => e.name)).toEqual([
            'board:kmt-input',
            'board:touch-input',
        ]);
    });

    it('rejects a value that only looks like a machine', () => {
        const board = {
            kmtInputStateMachine: { happens: () => undefined },
            cameraMux: {},
        };
        expect(resolveBoardMachines(board)).toEqual([]);
    });

    it('returns an empty list for a board with nothing', () => {
        expect(resolveBoardMachines({ cameraMux: undefined })).toEqual([]);
    });
});

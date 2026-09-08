import { AnyStateMachine } from './registry';

/**
 * The slice of a `Board` this helper reads. Typed loosely so tests can
 * stub it and so a `Board` from a second copy of `@ue-too/board` still
 * fits; every value is checked structurally before use.
 *
 * @category Types
 */
export type BoardLike = {
    kmtInputStateMachine?: unknown;
    touchInputStateMachine?: unknown;
    cameraMux: unknown;
};

/**
 * One machine found on a board, ready to attach.
 *
 * @category Types
 */
export type BoardMachineEntry = {
    name: string;
    machine: AnyStateMachine;
    samplePayloads: Record<string, unknown>;
};

/** Default fire-button payloads for the keyboard/mouse input machine. @category Types */
export const KMT_SAMPLE_PAYLOADS: Record<string, unknown> = {
    leftPointerDown: { x: 100, y: 100 },
    leftPointerUp: { x: 100, y: 100 },
    leftPointerMove: { x: 120, y: 110 },
    middlePointerDown: { x: 100, y: 100 },
    middlePointerUp: { x: 100, y: 100 },
    middlePointerMove: { x: 120, y: 110 },
    pointerMove: { x: 120, y: 110 },
    scroll: { deltaX: 0, deltaY: -100, x: 100, y: 100 },
    scrollWithCtrl: { deltaX: 0, deltaY: -100, x: 100, y: 100 },
};

/** Default fire-button payloads for the touch input machine. @category Types */
export const TOUCH_SAMPLE_PAYLOADS: Record<string, unknown> = {
    touchstart: {
        points: [
            { ident: 0, x: 100, y: 200 },
            { ident: 1, x: 300, y: 200 },
        ],
    },
    touchmove: {
        points: [
            { ident: 0, x: 110, y: 210 },
            { ident: 1, x: 310, y: 210 },
        ],
    },
    touchend: {
        points: [
            { ident: 0, x: 110, y: 210 },
            { ident: 1, x: 310, y: 210 },
        ],
    },
};

/**
 * Structural check for a `being` machine, mirroring `@ue-too/board`'s own
 * `hasBeingStateMachineShape`: no `instanceof`, so a machine from a second
 * copy of `@ue-too/being` still passes.
 */
function isStateMachine(value: unknown): value is AnyStateMachine {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.happens === 'function' &&
        'currentState' in candidate &&
        'states' in candidate &&
        'possibleStates' in candidate
    );
}

/**
 * Finds the `being` machines a `Board` exposes: the keyboard/mouse and
 * touch input machines, and the pan, zoom, and rotation control machines
 * on its camera mux. Anything the board lacks (a custom parser or mux) is
 * skipped rather than failing the whole call.
 *
 * @param namePrefix Names are `${namePrefix}:${suffix}`; two boards on
 * one page pass different prefixes.
 * @category Helpers
 */
export function resolveBoardMachines(
    board: BoardLike,
    namePrefix: string = 'board'
): BoardMachineEntry[] {
    const entries: BoardMachineEntry[] = [];
    const push = (
        suffix: string,
        machine: unknown,
        samplePayloads: Record<string, unknown> = {}
    ): void => {
        if (isStateMachine(machine)) {
            entries.push({
                name: `${namePrefix}:${suffix}`,
                machine,
                samplePayloads,
            });
        }
    };
    push('kmt-input', board.kmtInputStateMachine, KMT_SAMPLE_PAYLOADS);
    push('touch-input', board.touchInputStateMachine, TOUCH_SAMPLE_PAYLOADS);
    const mux = board.cameraMux;
    if (typeof mux === 'object' && mux !== null) {
        const getters = mux as Record<string, unknown>;
        push('pan-control', getters.panStateMachine);
        push('zoom-control', getters.zoomStateMachine);
        push('rotation-control', getters.rotateStateMachine);
    }
    return entries;
}

import { StateMachine, createVendingMachine } from '@ue-too/being';
import { Board, CameraMuxWithAnimationAndLock } from '@ue-too/board';

import { createAccountDemoMachine } from './account-demo';

/**
 * The board's camera-control machines live on the mux. Board types
 * `cameraMux` as the CameraMux interface, which does not declare the three
 * machine getters, so narrow to the concrete class the default Board builds.
 */
function cameraMuxOf(board: Board): CameraMuxWithAnimationAndLock {
    const mux = board.cameraMux;
    if (!(mux instanceof CameraMuxWithAnimationAndLock)) {
        throw new Error(
            'This board uses a custom CameraMux that does not expose camera control state machines.'
        );
    }
    return mux;
}

/**
 * Where a registry entry's machine comes from.
 *
 * - `simulated` constructs a fresh machine the page owns outright.
 * - `live` borrows a machine already running inside the page's viewport
 *   Board, so real input drives it. A live machine must never be
 *   `wrapup()`-ed by the page: that parks it in TERMINAL and the real board
 *   stops responding to input.
 */
export type MachineSource =
    | { kind: 'simulated'; create(): StateMachine<any, any, any, any> }
    | {
          kind: 'live';
          resolve(board: Board): StateMachine<any, any, any, any>;
      };

export type RegistryEntry = {
    id: string;
    label: string;
    samplePayloads: Record<string, unknown>;
    source: MachineSource;
};

export const registry: RegistryEntry[] = [
    {
        id: 'vending-machine',
        label: 'Vending machine (being example)',
        samplePayloads: {},
        source: {
            kind: 'simulated',
            // Concrete machines with literal-union States aren't
            // structurally assignable to StateMachine<any, any, any, any>:
            // State['states']'s conditional `string extends States ? string
            // : States` plus method variance defeats `any`-erasure. Confine
            // the cast to this registry boundary rather than loosening
            // `@ue-too/being`'s interfaces.
            create: () =>
                createVendingMachine() as unknown as StateMachine<
                    any,
                    any,
                    any,
                    any
                >,
        },
    },
    {
        id: 'account-demo',
        label: 'Bank account (preconditions demo)',
        samplePayloads: {
            withdraw: { amount: 60 },
            deposit: { amount: 50 },
        },
        source: {
            kind: 'simulated',
            create: () =>
                createAccountDemoMachine() as unknown as StateMachine<
                    any,
                    any,
                    any,
                    any
                >,
        },
    },
    {
        id: 'kmt-input',
        label: 'Board: keyboard/mouse input (live)',
        samplePayloads: {
            leftPointerDown: { x: 100, y: 100 },
            leftPointerUp: { x: 100, y: 100 },
            leftPointerMove: { x: 120, y: 110 },
            middlePointerDown: { x: 100, y: 100 },
            middlePointerUp: { x: 100, y: 100 },
            middlePointerMove: { x: 120, y: 110 },
            pointerMove: { x: 120, y: 110 },
            scroll: { deltaX: 0, deltaY: -100, x: 100, y: 100 },
            scrollWithCtrl: { deltaX: 0, deltaY: -100, x: 100, y: 100 },
        },
        source: {
            kind: 'live',
            resolve: board => {
                const machine = board.kmtInputStateMachine;
                if (machine === undefined) {
                    throw new Error(
                        'This board’s KMT parser does not expose a state machine.'
                    );
                }
                return machine as unknown as StateMachine<any, any, any, any>;
            },
        },
    },
    {
        id: 'pan-control',
        label: 'Board: pan control (live)',
        samplePayloads: {},
        source: {
            kind: 'live',
            resolve: board =>
                cameraMuxOf(board).panStateMachine as unknown as StateMachine<
                    any,
                    any,
                    any,
                    any
                >,
        },
    },
    {
        id: 'zoom-control',
        label: 'Board: zoom control (live)',
        samplePayloads: {},
        source: {
            kind: 'live',
            resolve: board =>
                cameraMuxOf(board).zoomStateMachine as unknown as StateMachine<
                    any,
                    any,
                    any,
                    any
                >,
        },
    },
    {
        id: 'rotation-control',
        label: 'Board: rotation control (live)',
        samplePayloads: {},
        source: {
            kind: 'live',
            resolve: board =>
                cameraMuxOf(board)
                    .rotateStateMachine as unknown as StateMachine<
                    any,
                    any,
                    any,
                    any
                >,
        },
    },
    {
        id: 'touch-input',
        label: 'Board: touch input (live)',
        samplePayloads: {
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
        },
        source: {
            kind: 'live',
            resolve: board => {
                const machine = board.touchInputStateMachine;
                if (machine === undefined) {
                    throw new Error(
                        'This board’s touch parser does not expose a state machine.'
                    );
                }
                return machine as unknown as StateMachine<any, any, any, any>;
            },
        },
    },
];

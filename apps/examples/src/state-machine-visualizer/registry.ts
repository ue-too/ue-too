import { StateMachine, createVendingMachine } from '@ue-too/being';
import {
    DummyCanvas,
    DummyKmtInputContext,
    TouchInputTracker,
    createDefaultPanControlStateMachine,
    createDefaultRotateControlStateMachine,
    createDefaultZoomControlStateMachine,
    createKmtInputStateMachine,
    createTouchInputStateMachine,
} from '@ue-too/board';

export type RegistryEntry = {
    id: string;
    label: string;
    create(): {
        machine: StateMachine<any, any, any, any>;
        samplePayloads: Record<string, unknown>;
    };
};

export const registry: RegistryEntry[] = [
    {
        id: 'vending-machine',
        label: 'Vending machine (being example)',
        create: () => ({
            // Concrete machines with literal-union States aren't
            // structurally assignable to StateMachine<any, any, any, any>:
            // State['states']'s conditional `string extends States ? string
            // : States` plus method variance defeats `any`-erasure. Confine
            // the cast to this registry boundary rather than loosening
            // `@ue-too/being`'s interfaces.
            machine: createVendingMachine() as unknown as StateMachine<
                any,
                any,
                any,
                any
            >,
            samplePayloads: {},
        }),
    },
    {
        id: 'kmt-input',
        label: 'Board: keyboard/mouse input',
        create: () => ({
            machine: createKmtInputStateMachine(
                new DummyKmtInputContext()
            ) as unknown as StateMachine<any, any, any, any>,
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
        }),
    },
    {
        id: 'pan-control',
        label: 'Board: pan control',
        create: () => ({
            machine:
                createDefaultPanControlStateMachine() as unknown as StateMachine<
                    any,
                    any,
                    any,
                    any
                >,
            samplePayloads: {},
        }),
    },
    {
        id: 'zoom-control',
        label: 'Board: zoom control',
        create: () => ({
            machine:
                createDefaultZoomControlStateMachine() as unknown as StateMachine<
                    any,
                    any,
                    any,
                    any
                >,
            samplePayloads: {},
        }),
    },
    {
        id: 'rotation-control',
        label: 'Board: rotation control',
        create: () => ({
            machine:
                createDefaultRotateControlStateMachine() as unknown as StateMachine<
                    any,
                    any,
                    any,
                    any
                >,
            samplePayloads: {},
        }),
    },
    {
        id: 'touch-input',
        label: 'Board: touch input',
        create: () => ({
            // No DummyTouchContext ships in @ue-too/board (unlike kmt's Dummy
            // context), but TouchContext's only non-trivial member is a
            // Canvas, and DummyCanvas already covers that. TouchInputTracker
            // is otherwise a plain in-memory touch-point tracker, so it
            // stubs cleanly and keeps the guarded IDLE->PENDING->IN_PROGRESS
            // transitions (which depend on tracked touch-point count/state)
            // actually functional for the demo.
            machine: createTouchInputStateMachine(
                new TouchInputTracker(new DummyCanvas())
            ) as unknown as StateMachine<any, any, any, any>,
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
        }),
    },
];

import { describe, expect, it } from 'vitest';

import { SharedPanelLike, createSharedAttachers } from '../src/attach';
import { MachineLike } from '../src/registry';

function fakeMachine(): MachineLike {
    return {
        happens: () => ({ handled: false }),
        currentState: 'IDLE',
        states: {},
        possibleStates: [],
        reset() {},
    };
}

function fakePanelFactory(options: { boardMachines?: number } = {}) {
    const panels: (SharedPanelLike & { disposed: boolean })[] = [];
    const factory = () => {
        let size = 0;
        const panel = {
            disposed: false,
            get size() {
                return size;
            },
            attach() {
                size += 1;
                return {
                    dispose() {
                        size -= 1;
                    },
                };
            },
            attachBoard() {
                const count = options.boardMachines ?? 5;
                if (count === 0) {
                    throw new Error('No being state machines found');
                }
                size += count;
                return {
                    dispose() {
                        size -= count;
                    },
                };
            },
            dispose() {
                panel.disposed = true;
            },
        };
        panels.push(panel);
        return panel;
    };
    return { factory, panels };
}

describe('shared attachers', () => {
    it('creates one panel lazily and reuses it', () => {
        const { factory, panels } = fakePanelFactory();
        const { attachMachineDebugger } = createSharedAttachers(factory);
        expect(panels).toHaveLength(0);
        attachMachineDebugger(fakeMachine());
        attachMachineDebugger(fakeMachine());
        expect(panels).toHaveLength(1);
        expect(panels[0].size).toBe(2);
    });

    it('disposes the panel when the last handle is disposed, then recreates', () => {
        const { factory, panels } = fakePanelFactory();
        const { attachMachineDebugger } = createSharedAttachers(factory);
        const a = attachMachineDebugger(fakeMachine());
        const b = attachMachineDebugger(fakeMachine());
        a.dispose();
        expect(panels[0].disposed).toBe(false);
        b.dispose();
        expect(panels[0].disposed).toBe(true);
        attachMachineDebugger(fakeMachine());
        expect(panels).toHaveLength(2);
    });

    it('ignores a second dispose of the same handle', () => {
        const { factory, panels } = fakePanelFactory();
        const { attachMachineDebugger } = createSharedAttachers(factory);
        const a = attachMachineDebugger(fakeMachine());
        const b = attachMachineDebugger(fakeMachine());
        a.dispose();
        a.dispose();
        expect(panels[0].size).toBe(1);
        expect(panels[0].disposed).toBe(false);
        b.dispose();
    });

    it('attachBoardDebugger shares the same panel', () => {
        const { factory, panels } = fakePanelFactory();
        const { attachMachineDebugger, attachBoardDebugger } =
            createSharedAttachers(factory);
        attachMachineDebugger(fakeMachine());
        const board = attachBoardDebugger({ cameraMux: {} });
        expect(panels).toHaveLength(1);
        expect(panels[0].size).toBe(6);
        board.dispose();
        expect(panels[0].size).toBe(1);
    });

    it('tears down an empty panel if attachBoardDebugger finds nothing', () => {
        const { factory, panels } = fakePanelFactory({ boardMachines: 0 });
        const { attachBoardDebugger } = createSharedAttachers(factory);
        expect(() => attachBoardDebugger({ cameraMux: {} })).toThrow(
            /No being state machines/
        );
        expect(panels[0].disposed).toBe(true);
    });
});

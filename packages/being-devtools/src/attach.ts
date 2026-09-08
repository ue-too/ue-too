import { BoardLike } from './board';
import { MachineDebugger } from './debugger';
import { configureHookAttach } from './hook';
import { AttachHandle, AttachOptions, MachineLike } from './registry';

/** The slice of {@link MachineDebugger} the shared-panel logic needs. */
export type SharedPanelLike = {
    attach(machine: MachineLike, options?: AttachOptions): AttachHandle;
    attachBoard(
        board: BoardLike,
        options?: { namePrefix?: string }
    ): AttachHandle;
    readonly size: number;
    dispose(): void;
};

/**
 * Builds the pair of one-liner attach functions over a lazily created
 * shared panel. The panel is created on the first attach and disposed
 * when the last handle is disposed, so a page that attaches and detaches
 * leaves no trace.
 */
export function createSharedAttachers(factory: () => SharedPanelLike): {
    attachMachineDebugger(
        machine: MachineLike,
        options?: AttachOptions
    ): AttachHandle;
    attachBoardDebugger(
        board: BoardLike,
        options?: { namePrefix?: string }
    ): AttachHandle;
} {
    let shared: SharedPanelLike | null = null;

    const panel = (): SharedPanelLike => {
        if (shared === null) {
            shared = factory();
        }
        return shared;
    };

    const tearDownIfEmpty = (): void => {
        if (shared !== null && shared.size === 0) {
            shared.dispose();
            shared = null;
        }
    };

    const wrap = (handle: AttachHandle): AttachHandle => {
        let disposed = false;
        return {
            dispose() {
                if (disposed) {
                    return;
                }
                disposed = true;
                handle.dispose();
                tearDownIfEmpty();
            },
        };
    };

    const guarded = (
        run: (p: SharedPanelLike) => AttachHandle
    ): AttachHandle => {
        const p = panel();
        try {
            return wrap(run(p));
        } catch (error) {
            tearDownIfEmpty();
            throw error;
        }
    };

    return {
        attachMachineDebugger: (machine, options) =>
            guarded(p => p.attach(machine, options)),
        attachBoardDebugger: (board, options) =>
            guarded(p => p.attachBoard(board, options)),
    };
}

const shared = createSharedAttachers(() => new MachineDebugger());

/**
 * Attaches a machine to the page's shared floating panel, creating the
 * panel on first use. Press Ctrl+Shift+M (Cmd+Shift+M on macOS) to open it.
 *
 * @example
 * ```ts
 * const handle = attachMachineDebugger(machine, { name: 'pan-control' });
 * // on teardown
 * handle.dispose();
 * ```
 *
 * @category Core
 */
export function attachMachineDebugger(
    machine: MachineLike,
    options?: AttachOptions
): AttachHandle {
    return shared.attachMachineDebugger(machine, options);
}

/**
 * Attaches every `being` machine a `Board` exposes — keyboard/mouse input,
 * touch input, pan, zoom, and rotation control — to the shared panel.
 *
 * @throws Error when the board exposes no machines at all.
 * @category Core
 */
export function attachBoardDebugger(
    board: BoardLike,
    options?: { namePrefix?: string }
): AttachHandle {
    return shared.attachBoardDebugger(board, options);
}

configureHookAttach(attachMachineDebugger);

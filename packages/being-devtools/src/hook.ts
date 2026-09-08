import { AttachHandle, AttachOptions, MachineLike } from './registry';

/** The property name installed on `window`. @category Types */
export const HOOK_KEY = '__UE_TOO_BEING__';

/** What a panel must expose to be reachable from the hook. */
export type HookPanel = {
    open(): void;
    close(): void;
    readonly machines: ReadonlyMap<string, MachineLike>;
};

/**
 * The console hook at `window.__UE_TOO_BEING__`, present while at least
 * one panel is alive.
 *
 * @remarks
 * `machines` is the union across every live panel. `open()` and `close()`
 * address the most recently created panel. `attach()` goes to the shared
 * overlay panel, exactly like `attachMachineDebugger`.
 *
 * @category Types
 */
export type BeingDevtoolsHook = {
    readonly machines: ReadonlyMap<string, MachineLike>;
    open(): void;
    close(): void;
    attach(machine: MachineLike, options?: AttachOptions): AttachHandle;
};

/** Where the hook is installed. `window` in a browser; injectable for tests. */
export type HookTarget = Record<string, unknown>;

type HookAttach = BeingDevtoolsHook['attach'];

const panels: HookPanel[] = [];
let installedOn: HookTarget | null = null;
let hookAttach: HookAttach = () => {
    throw new Error(
        'being-devtools hook attach is not configured; import the package entry point.'
    );
};

function defaultTarget(): HookTarget | undefined {
    return typeof window === 'undefined'
        ? undefined
        : (window as unknown as HookTarget);
}

function createHook(): BeingDevtoolsHook {
    return {
        get machines() {
            const all = new Map<string, MachineLike>();
            for (const panel of panels) {
                for (const [name, machine] of panel.machines) {
                    all.set(name, machine);
                }
            }
            return all;
        },
        open() {
            panels[panels.length - 1]?.open();
        },
        close() {
            panels[panels.length - 1]?.close();
        },
        attach(machine, options) {
            return hookAttach(machine, options);
        },
    };
}

/** Supplies the function the hook's `attach()` delegates to. */
export function configureHookAttach(fn: HookAttach): void {
    hookAttach = fn;
}

/**
 * Adds a panel to the hook, installing the hook on `target` if it is the
 * first. Passing `undefined` as the target (no `window`) is a no-op for
 * installation but still tracks the panel.
 */
export function registerPanel(
    panel: HookPanel,
    target: HookTarget | undefined = defaultTarget()
): void {
    if (!panels.includes(panel)) {
        panels.push(panel);
    }
    if (target !== undefined && installedOn === null) {
        target[HOOK_KEY] = createHook();
        installedOn = target;
    }
}

/** Removes a panel; the hook is uninstalled when no panels remain. */
export function unregisterPanel(panel: HookPanel): void {
    const index = panels.indexOf(panel);
    if (index !== -1) {
        panels.splice(index, 1);
    }
    if (panels.length === 0 && installedOn !== null) {
        delete installedOn[HOOK_KEY];
        installedOn = null;
    }
}

import { afterEach, describe, expect, it } from 'vitest';

import {
    BeingDevtoolsHook,
    HOOK_KEY,
    HookPanel,
    configureHookAttach,
    registerPanel,
    unregisterPanel,
} from '../src/hook';
import { MachineLike } from '../src/registry';

function fakePanel(
    names: string[]
): HookPanel & { opened: number; closed: number } {
    const machines = new Map<string, MachineLike>();
    for (const name of names) {
        machines.set(name, { name } as unknown as MachineLike);
    }
    return {
        opened: 0,
        closed: 0,
        machines,
        open() {
            this.opened += 1;
        },
        close() {
            this.closed += 1;
        },
    };
}

function hookOn(target: Record<string, unknown>): BeingDevtoolsHook {
    return target[HOOK_KEY] as BeingDevtoolsHook;
}

describe('window hook', () => {
    const registered: HookPanel[] = [];
    afterEach(() => {
        for (const panel of registered.splice(0)) {
            unregisterPanel(panel);
        }
    });
    const register = (panel: HookPanel, target: Record<string, unknown>) => {
        registerPanel(panel, target);
        registered.push(panel);
    };

    it('installs on the first panel and removes on the last', () => {
        const target: Record<string, unknown> = {};
        const a = fakePanel(['a']);
        const b = fakePanel(['b']);
        register(a, target);
        expect(hookOn(target)).toBeDefined();
        register(b, target);
        unregisterPanel(a);
        expect(hookOn(target)).toBeDefined();
        unregisterPanel(b);
        expect(HOOK_KEY in target).toBe(false);
        registered.length = 0;
    });

    it('unions machines across live panels', () => {
        const target: Record<string, unknown> = {};
        register(fakePanel(['a', 'b']), target);
        register(fakePanel(['c']), target);
        expect([...hookOn(target).machines.keys()]).toEqual(['a', 'b', 'c']);
    });

    it('open and close address the most recently registered panel', () => {
        const target: Record<string, unknown> = {};
        const first = fakePanel([]);
        const second = fakePanel([]);
        register(first, target);
        register(second, target);
        hookOn(target).open();
        hookOn(target).close();
        expect(first.opened + first.closed).toBe(0);
        expect(second.opened).toBe(1);
        expect(second.closed).toBe(1);
    });

    it('attach delegates to the configured function', () => {
        const target: Record<string, unknown> = {};
        register(fakePanel([]), target);
        let received: unknown = null;
        const handle = { dispose() {} };
        configureHookAttach((machine, options) => {
            received = { machine, options };
            return handle;
        });
        const machine = { happens() {} } as unknown as Parameters<
            BeingDevtoolsHook['attach']
        >[0];
        expect(hookOn(target).attach(machine, { name: 'x' })).toBe(handle);
        expect(received).toEqual({ machine, options: { name: 'x' } });
    });

    it('does nothing when there is no target', () => {
        expect(() => registerPanel(fakePanel([]), undefined)).not.toThrow();
    });
});

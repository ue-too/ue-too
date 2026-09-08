import { createVendingMachine } from '@ue-too/being';
import { describe, expect, it } from 'vitest';

import { AttachedMachine, MachineLike, MachineRegistry } from '../src/registry';

function fakeMachine(): MachineLike {
    return {
        happens: () => ({ handled: false }),
        currentState: 'IDLE',
        states: {},
        possibleStates: [],
        reset() {},
    };
}

describe('MachineRegistry', () => {
    it('assigns sequential default names in attach order', () => {
        const registry = new MachineRegistry();
        const a = registry.attach(fakeMachine(), {}, () => undefined);
        const b = registry.attach(fakeMachine(), {}, () => undefined);
        expect(a.name).toBe('machine-1');
        expect(b.name).toBe('machine-2');
        expect(registry.names).toEqual(['machine-1', 'machine-2']);
    });

    it('skips a default name that was taken explicitly', () => {
        const registry = new MachineRegistry();
        registry.attach(fakeMachine(), { name: 'machine-1' }, () => undefined);
        const next = registry.attach(fakeMachine(), {}, () => undefined);
        expect(next.name).toBe('machine-2');
    });

    it('throws on a duplicate explicit name before subscribing', () => {
        const registry = new MachineRegistry();
        registry.attach(fakeMachine(), { name: 'pan' }, () => undefined);
        let subscribed = false;
        expect(() =>
            registry.attach(fakeMachine(), { name: 'pan' }, () => {
                subscribed = true;
                return undefined;
            })
        ).toThrow(/"pan" is already attached/);
        expect(subscribed).toBe(false);
        expect(registry.size).toBe(1);
    });

    it('passes the entry to the subscriber and stores sample payloads', () => {
        const registry = new MachineRegistry();
        let seen: AttachedMachine | null = null;
        const entry = registry.attach(
            fakeMachine(),
            { name: 'x', samplePayloads: { go: { speed: 1 } } },
            e => {
                seen = e;
                return undefined;
            }
        );
        expect(seen).toBe(entry);
        expect(entry.samplePayloads).toEqual({ go: { speed: 1 } });
        expect(registry.get('x')).toBe(entry);
    });

    it('does not register an entry whose subscriber throws', () => {
        const registry = new MachineRegistry();
        expect(() =>
            registry.attach(fakeMachine(), { name: 'x' }, () => {
                throw new Error('layout failed');
            })
        ).toThrow('layout failed');
        expect(registry.size).toBe(0);
    });

    it('detach runs the disposer exactly once', () => {
        const registry = new MachineRegistry();
        let disposals = 0;
        registry.attach(fakeMachine(), { name: 'x' }, () => () => {
            disposals += 1;
        });
        expect(registry.detach('x')).toBe(true);
        expect(registry.detach('x')).toBe(false);
        expect(disposals).toBe(1);
        expect(registry.size).toBe(0);
    });

    it('detachAll disposes everything', () => {
        const registry = new MachineRegistry();
        let disposals = 0;
        const disposer = () => {
            disposals += 1;
        };
        registry.attach(fakeMachine(), {}, () => disposer);
        registry.attach(fakeMachine(), {}, () => disposer);
        registry.detachAll();
        expect(disposals).toBe(2);
        expect(registry.size).toBe(0);
    });

    it('accepts a concrete TemplateStateMachine without a cast', () => {
        // Compile-time check: createVendingMachine() has literal-union
        // States and must satisfy MachineLike directly.
        const registry = new MachineRegistry();
        const entry = registry.attach(
            createVendingMachine(),
            { name: 'vending' },
            () => undefined
        );
        expect(entry.machine.currentState).toBeDefined();
    });
});

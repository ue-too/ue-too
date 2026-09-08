import { StateMachine } from '@ue-too/being';

/**
 * Internal: a fully erased machine. Never appears in a public signature.
 */
export type AnyStateMachine = StateMachine<any, any, any, any>;

/**
 * The structural surface a machine must have to be attached.
 *
 * @remarks
 * Concrete `TemplateStateMachine`s with literal-union States are not
 * assignable to `StateMachine<any, any, any, any>` (the conditional in
 * `State['states']` plus method variance defeats `any`-erasure), so the
 * public parameter type is this minimal shape, which they satisfy without
 * a cast. The erasure happens once, inside {@link MachineRegistry.attach}.
 *
 * @category Types
 */
export type MachineLike = {
    happens(...args: any[]): unknown;
    currentState: unknown;
    states: object;
    possibleStates: readonly unknown[];
    context?: unknown;
    reset(): void;
    onEventResult?(callback: (...args: any[]) => void): void | (() => void);
};

/**
 * Options for attaching one machine.
 *
 * @category Types
 */
export type AttachOptions = {
    /** Tab label. Must be unique within a panel; a collision throws. */
    name?: string;
    /** Default payload JSON shown under each event's fire button. */
    samplePayloads?: Record<string, unknown>;
};

/**
 * Returned by every attach call. `dispose()` detaches the machine(s) and
 * releases their subscriptions. Safe to call more than once.
 *
 * @category Types
 */
export type AttachHandle = { dispose(): void };

/**
 * An attached machine as the panel sees it.
 *
 * @category Types
 */
export type AttachedMachine = {
    readonly name: string;
    readonly machine: AnyStateMachine;
    readonly samplePayloads: Record<string, unknown>;
};

/**
 * Called once per successful attach. Returns the disposer for whatever it
 * subscribed, or `undefined` if it subscribed nothing.
 */
export type Subscriber = (entry: AttachedMachine) => (() => void) | undefined;

/**
 * Name → machine bookkeeping for one panel. Owns nothing but the
 * subscription disposers; the panel owns the DOM.
 *
 * @category Core
 */
export class MachineRegistry {
    private readonly records = new Map<
        string,
        { entry: AttachedMachine; unsubscribe: (() => void) | undefined }
    >();
    private unnamedCount = 0;

    get size(): number {
        return this.records.size;
    }

    /** Names in attach order. */
    get names(): string[] {
        return [...this.records.keys()];
    }

    get(name: string): AttachedMachine | undefined {
        return this.records.get(name)?.entry;
    }

    /**
     * Registers a machine. The name is resolved and checked first, then
     * `subscribe` runs, then the record is stored — so a duplicate name
     * never subscribes and a throwing subscriber never registers.
     *
     * @throws Error when `options.name` is already attached.
     */
    attach(
        machine: MachineLike,
        options: AttachOptions,
        subscribe: Subscriber
    ): AttachedMachine {
        const name = this.resolveName(options.name);
        const entry: AttachedMachine = {
            name,
            machine: machine as unknown as AnyStateMachine,
            samplePayloads: options.samplePayloads ?? {},
        };
        const unsubscribe = subscribe(entry);
        this.records.set(name, { entry, unsubscribe });
        return entry;
    }

    /** @returns false when nothing by that name was attached. */
    detach(name: string): boolean {
        const record = this.records.get(name);
        if (record === undefined) {
            return false;
        }
        this.records.delete(name);
        record.unsubscribe?.();
        return true;
    }

    detachAll(): void {
        for (const name of this.names) {
            this.detach(name);
        }
    }

    private resolveName(requested: string | undefined): string {
        if (requested !== undefined) {
            if (this.records.has(requested)) {
                throw new Error(
                    `A machine named "${requested}" is already attached to this debugger.`
                );
            }
            return requested;
        }
        let name: string;
        do {
            this.unnamedCount += 1;
            name = `machine-${this.unnamedCount}`;
        } while (this.records.has(name));
        return name;
    }
}

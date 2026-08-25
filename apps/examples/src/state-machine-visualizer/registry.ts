import { StateMachine, createVendingMachine } from '@ue-too/being';

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
];

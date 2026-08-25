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
            machine: createVendingMachine(),
            samplePayloads: {},
        }),
    },
];

import { createVendingMachine } from '@ue-too/being';
import { MachineDebugger } from '@ue-too/being-devtools';

import { createAccountDemoMachine } from './account-demo';

const container = document.getElementById('app')!;

// Inline mount: the page is the panel. Everything attached here is
// borrowed, so the panel never wraps anything up; reset is the recovery
// for a live machine stranded by a hand-fired half-gesture.
const panel = new MachineDebugger({ container, openByDefault: true });

panel.attach(createVendingMachine(), {
    name: 'Vending machine (being example)',
});
panel.attach(createAccountDemoMachine(), {
    name: 'Bank account (preconditions demo)',
    samplePayloads: {
        withdraw: { amount: 60 },
        deposit: { amount: 50 },
    },
});

// The diagram's own viewport: the board being charted is the board you
// are panning. Hold spacebar over the chart and watch the pan machine.
panel.attachBoard(panel.board);

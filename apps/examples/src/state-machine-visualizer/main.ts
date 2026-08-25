import { StateMachine } from '@ue-too/being';
import { Board } from '@ue-too/board';

import { RegistryEntry, registry } from './registry';

const canvas = document.getElementById('graph') as HTMLCanvasElement;
const board = new Board();
board.attach(canvas);

const machineSelect = document.getElementById(
    'machine-select'
) as HTMLSelectElement;
const currentStateEl = document.getElementById('current-state')!;
const panelErrorEl = document.getElementById('panel-error')!;

let machine: StateMachine<any, any, any, any> | null = null;

function selectMachine(entry: RegistryEntry): void {
    if (machine) {
        machine.wrapup();
        machine = null;
    }
    panelErrorEl.textContent = '';
    try {
        const created = entry.create();
        machine = created.machine;
    } catch (error) {
        panelErrorEl.textContent = `Failed to create "${entry.label}": ${String(error)}`;
    }
}

for (const entry of registry) {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.label;
    machineSelect.appendChild(option);
}
machineSelect.addEventListener('change', () => {
    const entry = registry.find(e => e.id === machineSelect.value);
    if (entry) {
        selectMachine(entry);
    }
});
selectMachine(registry[0]);

function step() {
    board.step(performance.now());
    currentStateEl.textContent = machine
        ? `Current state: ${String(machine.currentState)}`
        : 'No machine loaded';
    requestAnimationFrame(step);
}
requestAnimationFrame(step);

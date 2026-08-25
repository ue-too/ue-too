import { StateMachine, extractMachineGraph } from '@ue-too/being';
import { Board } from '@ue-too/board';

import { LaidOutGraph, layoutGraph } from './layout';
import { RegistryEntry, registry } from './registry';
import { Flash, drawGraph } from './render';

const canvas = document.getElementById('graph') as HTMLCanvasElement;
const board = new Board();
board.attach(canvas);

const machineSelect = document.getElementById(
    'machine-select'
) as HTMLSelectElement;
const currentStateEl = document.getElementById('current-state')!;
const panelErrorEl = document.getElementById('panel-error')!;

let machine: StateMachine<any, any, any, any> | null = null;
let layout: LaidOutGraph | null = null;
let flash: Flash = null;

const measureCtx = document.createElement('canvas').getContext('2d')!;
function measureText(text: string): number {
    measureCtx.font = '13px system-ui, sans-serif';
    return measureCtx.measureText(text).width;
}

function selectMachine(entry: RegistryEntry): void {
    if (machine) {
        machine.wrapup();
        machine = null;
        layout = null;
    }
    panelErrorEl.textContent = '';
    try {
        const created = entry.create();
        machine = created.machine;
        layout = layoutGraph(extractMachineGraph(created.machine), measureText);
        flash = null;
    } catch (error) {
        layout = null;
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
    if (board.context && layout) {
        const current = machine ? String(machine.currentState) : null;
        drawGraph(board.context, layout, current, flash, performance.now());
    }
    currentStateEl.textContent = machine
        ? `Current state: ${String(machine.currentState)}`
        : 'No machine loaded';
    requestAnimationFrame(step);
}
requestAnimationFrame(step);

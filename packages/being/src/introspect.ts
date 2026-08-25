/**
 * @packageDocumentation
 * Read-only introspection utilities for state machines.
 */
import { StateMachine } from './interface';

/**
 * A node in an extracted machine graph — one per possible state.
 *
 * @category Introspection
 */
export type MachineGraphNode = { id: string };

/**
 * A directed edge in an extracted machine graph.
 *
 * @remarks
 * `guard` is set when the edge comes from an `eventGuards` mapping; it holds
 * the guard's key in the state's guard registry. Edges with `to === from` are
 * self-loops (a reaction without a `defaultTargetState`).
 *
 * @category Introspection
 */
export type MachineGraphEdge = {
    from: string;
    to: string;
    event: string;
    guard?: string;
};

/**
 * A state machine's structure as a directed graph.
 *
 * @category Introspection
 */
export type MachineGraph = {
    nodes: MachineGraphNode[];
    edges: MachineGraphEdge[];
};

/**
 * Extracts a machine's states and transitions as a directed graph.
 *
 * @remarks
 * Reads only the machine's public surface (`possibleStates`, each state's
 * `eventReactions` and `eventGuards`) — the machine's behavior is untouched.
 * Per state and event, emits one edge to the reaction's
 * `defaultTargetState` (or a self-loop when it has none), plus one
 * guard-labeled edge per `eventGuards` mapping.
 *
 * @category Introspection
 */
export function extractMachineGraph(
    machine: StateMachine<any, any, any, any>
): MachineGraph {
    const stateIds = machine.possibleStates as string[];
    const nodes: MachineGraphNode[] = stateIds.map(id => ({ id }));
    const edges: MachineGraphEdge[] = [];
    for (const stateId of stateIds) {
        const state = machine.states[stateId];
        const reactions = state.eventReactions as Record<
            string,
            { defaultTargetState?: string }
        >;
        const eventGuards = state.eventGuards as Record<
            string,
            { guard: string; target: string }[] | undefined
        >;
        for (const event of Object.keys(reactions)) {
            edges.push({
                from: stateId,
                to: reactions[event].defaultTargetState ?? stateId,
                event,
            });
            for (const mapping of eventGuards[event] ?? []) {
                edges.push({
                    from: stateId,
                    to: mapping.target,
                    event,
                    guard: mapping.guard,
                });
            }
        }
    }
    return { nodes, edges };
}

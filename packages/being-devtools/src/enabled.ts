import { StateMachine } from '@ue-too/being';

import { LaidOutGraph } from './layout';

/**
 * Which edges can fire right now: the edge must leave the current state,
 * and every declared precondition must pass against the live context.
 *
 * @remarks
 * Routing-guard edges are not evaluated — their truth depends on
 * post-action context, which cannot be known before firing. A precondition
 * whose guard is missing fails closed, matching the machine's own veto. A
 * guard that throws leaves the edge enabled: this is display only, and a
 * throwing guard should not silently dim a transition.
 *
 * @returns One flag per entry of `layout.edges`, in order.
 * @category Helpers
 */
export function computeEnabledEdges(
    machine: StateMachine<any, any, any, any>,
    layout: LaidOutGraph
): boolean[] {
    const current = String(machine.currentState);
    const context = machine.context;
    return layout.edges.map(edge => {
        if (edge.from !== current) {
            return false;
        }
        if (
            !edge.preconditions ||
            edge.preconditions.length === 0 ||
            context === undefined
        ) {
            return true;
        }
        const guards = (machine.states[edge.from]?.guards ?? {}) as Record<
            string,
            (context: unknown) => boolean
        >;
        return edge.preconditions.every(name => {
            const evaluate = guards[name];
            if (evaluate === undefined) {
                return false;
            }
            try {
                return evaluate(context);
            } catch {
                return true;
            }
        });
    });
}

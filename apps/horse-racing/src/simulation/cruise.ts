import { K_CRUISE } from './types';

/**
 * Proportional cruise controller. Returns the tangential force the engine
 * must apply to drag `currentVel` toward `targetVel`.
 */
export function computeCruiseForce(currentVel: number, targetVel: number): number {
    return K_CRUISE * (targetVel - currentVel);
}

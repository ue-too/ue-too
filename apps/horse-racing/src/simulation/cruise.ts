import { K_CRUISE } from './types';

/**
 * Proportional cruise controller. Returns the tangential force the engine
 * must apply to drag `currentVel` toward `cruiseSpeed`.
 */
export function computeCruiseForce(currentVel: number, cruiseSpeed: number): number {
    return K_CRUISE * (cruiseSpeed - currentVel);
}

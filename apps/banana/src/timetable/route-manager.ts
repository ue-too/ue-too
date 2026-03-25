/**
 * Manages named routes (reusable joint sequences) for the timetable system.
 *
 * @module timetable/route-manager
 */

import { Observable, SynchronousObservable } from '@ue-too/board';

import type { TrackGraph } from '@/trains/tracks/track';
import type {
  Route,
  RouteId,
  SerializedRoute,
} from './types';

/** Payload emitted when the route collection changes. */
export type RouteChangeEvent = {
  type: 'add' | 'update' | 'remove';
  routeId: RouteId;
};

/**
 * CRUD manager for {@link Route} objects.
 *
 * @remarks
 * Routes are stored in a `Map` keyed by string ID.  The manager exposes an
 * observable so UI components can react to additions, updates, and removals.
 *
 * @example
 * ```typescript
 * const mgr = new RouteManager();
 * mgr.addRoute({ id: 'main-north', name: 'Main Line North', joints: [...] });
 * const route = mgr.getRoute('main-north');
 * ```
 */
export class RouteManager {
  private _routes: Map<RouteId, Route> = new Map();
  private _observable: Observable<[RouteChangeEvent]> =
    new SynchronousObservable<[RouteChangeEvent]>();

  // -----------------------------------------------------------------------
  // CRUD
  // -----------------------------------------------------------------------

  /**
   * Add a new route.
   *
   * @param route - The route to add.  The `id` must be unique.
   * @throws If a route with the same ID already exists.
   */
  addRoute(route: Route): void {
    if (this._routes.has(route.id)) {
      throw new Error(`Route with id "${route.id}" already exists`);
    }
    this._routes.set(route.id, route);
    this._observable.notify({ type: 'add', routeId: route.id });
  }

  /**
   * Replace an existing route with updated data.
   *
   * @param route - Updated route.  Must have an ID that already exists.
   * @throws If no route with the given ID exists.
   */
  updateRoute(route: Route): void {
    if (!this._routes.has(route.id)) {
      throw new Error(`Route with id "${route.id}" does not exist`);
    }
    this._routes.set(route.id, route);
    this._observable.notify({ type: 'update', routeId: route.id });
  }

  /**
   * Remove a route by ID.
   *
   * @returns `true` if the route existed and was removed.
   */
  removeRoute(id: RouteId): boolean {
    const deleted = this._routes.delete(id);
    if (deleted) {
      this._observable.notify({ type: 'remove', routeId: id });
    }
    return deleted;
  }

  /** Retrieve a route by ID, or `null` if not found. */
  getRoute(id: RouteId): Route | null {
    return this._routes.get(id) ?? null;
  }

  /** Return all routes as an array. */
  getAllRoutes(): Route[] {
    return [...this._routes.values()];
  }

  /** Subscribe to route collection changes. Returns an unsubscribe function. */
  subscribe(listener: (event: RouteChangeEvent) => void): () => void {
    return this._observable.subscribe(listener);
  }

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  /**
   * Check whether every consecutive pair of joints in a route is connected by
   * a track segment.
   *
   * @param route - The route to validate.
   * @param trackGraph - The current track graph.
   * @returns `true` if the route is valid against the track graph.
   */
  validate(route: Route, trackGraph: TrackGraph): boolean {
    const { joints } = route;
    if (joints.length < 2) return joints.length === 1;

    for (let i = 0; i < joints.length - 1; i++) {
      const from = joints[i];
      const to = joints[i + 1];
      const joint = trackGraph.getJoint(from.jointNumber);
      if (joint === null) return false;
      // The "to" joint must be reachable from the "from" joint in the
      // specified direction.
      if (!joint.direction[from.direction].has(to.jointNumber)) return false;

      // For intermediate joints (not the first), verify that the arrival
      // direction and departure direction are on opposite sides.  If the
      // previous joint reached this one, the train arrives from one side and
      // must depart from the other.
      if (i > 0) {
        const prev = joints[i - 1];
        const arrivalSide = this._arrivalSide(from.jointNumber, prev.jointNumber, trackGraph);
        if (arrivalSide === null) return false;
        // Departure direction must be opposite to the arrival side.
        if (from.direction === arrivalSide) return false;
      }
    }
    return true;
  }

  /**
   * Determine which direction side `fromJoint` is in at `atJoint`.
   *
   * @returns `'tangent'` or `'reverseTangent'`, or `null` if not found.
   */
  private _arrivalSide(
    atJointNumber: number,
    fromJointNumber: number,
    trackGraph: TrackGraph,
  ): 'tangent' | 'reverseTangent' | null {
    const joint = trackGraph.getJoint(atJointNumber);
    if (!joint) return null;
    if (joint.direction.tangent.has(fromJointNumber)) return 'tangent';
    if (joint.direction.reverseTangent.has(fromJointNumber)) return 'reverseTangent';
    return null;
  }

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  serialize(): SerializedRoute[] {
    return this.getAllRoutes().map((r) => ({
      id: r.id,
      name: r.name,
      joints: r.joints.map((j) => ({ ...j })),
    }));
  }

  static deserialize(data: SerializedRoute[]): RouteManager {
    const manager = new RouteManager();
    for (const sr of data) {
      manager._routes.set(sr.id, {
        id: sr.id,
        name: sr.name,
        joints: sr.joints.map((j) => ({ ...j })),
      });
    }
    return manager;
  }
}

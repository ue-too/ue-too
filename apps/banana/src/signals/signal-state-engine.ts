/**
 * Per-frame signal aspect computation engine.
 *
 * @remarks
 * Each frame, after the {@link OccupancyRegistry} is rebuilt, this engine
 * recomputes every signal's aspect based on block occupancy.  It also
 * provides a forward-walk helper that auto-drivers use to find the distance
 * to the next restrictive (RED or YELLOW) signal.
 *
 * @module signals/signal-state-engine
 */

import type { OccupancyRegistry } from '@/trains/occupancy-registry';
import type { PlacedTrainEntry } from '@/trains/train-manager';
import type { TrackGraph } from '@/trains/tracks/track';
import type { TrainPosition } from '@/trains/formation';
import type { JointDirectionManager } from '@/trains/input-state-machine/train-kmt-state-machine';

import type { BlockSignalManager } from './block-signal-manager';
import type { SignalAspect, SignalId, BlockId } from './types';

/** Maximum arc-length lookahead when searching for the next signal. */
const MAX_LOOKAHEAD = 500;

/**
 * Result of a forward signal search.
 */
export type RestrictiveSignalResult = {
  /** Arc-length distance from the query position to the signal. */
  distance: number;
  /** The signal's current aspect. */
  aspect: 'red' | 'yellow';
  /** ID of the restrictive signal found. */
  signalId: SignalId;
};

/**
 * Computes and caches signal aspects each frame.
 *
 * @group Signal System
 */
export class SignalStateEngine {
  private _aspects: Map<SignalId, SignalAspect> = new Map();
  private _blockOccupied: Map<BlockId, boolean> = new Map();
  private _bsm: BlockSignalManager;

  constructor(blockSignalManager: BlockSignalManager) {
    this._bsm = blockSignalManager;
  }

  /**
   * Recompute all signal aspects from current occupancy data.
   *
   * @param occupancyRegistry - The freshly-rebuilt occupancy data for this frame.
   * @param placedTrains - All placed trains, needed for partial-segment occupancy checks.
   */
  update(
    occupancyRegistry: OccupancyRegistry,
    placedTrains: readonly PlacedTrainEntry[],
  ): void {
    this._blockOccupied.clear();
    this._aspects.clear();

    const blocks = this._bsm.getBlocks();
    const signals = this._bsm.getSignals();

    // Pass 1: determine block occupancy
    for (const [blockId, block] of blocks) {
      let occupied = false;
      for (const entry of block.segments) {
        const trainsOnSeg = occupancyRegistry.getTrainsOnSegment(entry.segmentNumber);
        if (trainsOnSeg.size === 0) continue;

        if (entry.fromT === 0 && entry.toT === 1) {
          // Full segment — any train on it means occupied
          occupied = true;
          break;
        }

        // Partial segment — check if any train's position or bogies fall within range
        occupied = this._isPartialSegmentOccupied(
          entry.segmentNumber,
          entry.fromT,
          entry.toT,
          trainsOnSeg,
          placedTrains,
        );
        if (occupied) break;
      }
      this._blockOccupied.set(blockId, occupied);
    }

    // Pass 2: compute signal aspects.
    // RED depends only on block occupancy; YELLOW depends on the next signal
    // being RED.  We iterate twice: first pass sets RED/GREEN, second pass
    // upgrades GREEN→YELLOW where the downstream signal is RED.
    for (const [signalId] of signals) {
      const block = this._bsm.getBlockByEntrySignal(signalId);
      if (!block) {
        this._aspects.set(signalId, 'green');
        continue;
      }
      if (this._blockOccupied.get(block.id)) {
        this._aspects.set(signalId, 'red');
      } else {
        this._aspects.set(signalId, 'green');
      }
    }

    // Second pass: upgrade GREEN → YELLOW where next signal is RED
    for (const [signalId] of signals) {
      if (this._aspects.get(signalId) !== 'green') continue;
      const block = this._bsm.getBlockByEntrySignal(signalId);
      if (!block || block.exitSignalId === null) continue;
      if (this._aspects.get(block.exitSignalId) === 'red') {
        this._aspects.set(signalId, 'yellow');
      }
    }
  }

  /** Get the current aspect of a signal. Returns `'green'` for unknown signals. */
  getAspect(signalId: SignalId): SignalAspect {
    return this._aspects.get(signalId) ?? 'green';
  }

  /**
   * Walk forward from a train position and find the nearest restrictive signal.
   *
   * @param position - The train's current position.
   * @param trackGraph - Track topology.
   * @param jdm - Junction decision manager for the train's route.
   * @returns The distance and aspect of the nearest RED/YELLOW signal, or `null`
   *          if no restrictive signal is found within the lookahead distance.
   */
  getDistanceToRestrictiveSignal(
    position: TrainPosition,
    trackGraph: TrackGraph,
    jdm: JointDirectionManager,
  ): RestrictiveSignalResult | null {
    let totalDistance = 0;
    let currentSegNum = position.trackSegment;
    let currentT = position.tValue;
    let currentDir = position.direction;

    const seg = trackGraph.getTrackSegmentWithJoints(currentSegNum);
    if (!seg) return null;

    // --- Check signals on the current segment ahead of the train ---
    const result = this._checkSignalsOnSegment(
      currentSegNum,
      currentT,
      currentDir,
      trackGraph,
      0,
    );
    if (result) return result;

    // Distance from current position to end of current segment
    const posLength = seg.curve.lengthAtT(currentT);
    if (currentDir === 'tangent') {
      totalDistance += seg.curve.fullLength - posLength;
    } else {
      totalDistance += posLength;
    }

    // --- Walk through subsequent segments ---
    let walkSegNum = currentSegNum;
    let walkDir = currentDir;

    while (totalDistance < MAX_LOOKAHEAD) {
      const walkSeg = trackGraph.getTrackSegmentWithJoints(walkSegNum);
      if (!walkSeg) break;

      // Determine which joint we're exiting through
      const exitJointNumber =
        walkDir === 'tangent' ? walkSeg.t1Joint : walkSeg.t0Joint;
      const entryJointNumber =
        walkDir === 'tangent' ? walkSeg.t0Joint : walkSeg.t1Joint;

      const exitJoint = trackGraph.getJoint(exitJointNumber);
      if (!exitJoint) break;

      // Determine the direction at the exit joint
      const nextJointDir = exitJoint.direction.reverseTangent.has(entryJointNumber)
        ? 'tangent' as const
        : 'reverseTangent' as const;

      const next = jdm.getNextJoint(exitJointNumber, nextJointDir);
      if (!next) break;

      const nextSeg = trackGraph.getTrackSegmentWithJoints(next.curveNumber);
      if (!nextSeg) break;

      // Check signals on this new segment
      const startT = next.direction === 'tangent' ? 0 : 1;
      const signalResult = this._checkSignalsOnSegment(
        next.curveNumber,
        startT,
        next.direction,
        trackGraph,
        totalDistance,
      );
      if (signalResult) return signalResult;

      totalDistance += nextSeg.curve.fullLength;
      walkSegNum = next.curveNumber;
      walkDir = next.direction;
    }

    return null;
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Check for restrictive signals on a segment ahead of a given t-value.
   *
   * @returns The first restrictive signal found, or `null`.
   */
  private _checkSignalsOnSegment(
    segmentNumber: number,
    currentT: number,
    direction: 'tangent' | 'reverseTangent',
    trackGraph: TrackGraph,
    baseDistance: number,
  ): RestrictiveSignalResult | null {
    const signals = this._bsm.getSignalsOnSegment(segmentNumber);
    if (signals.length === 0) return null;

    const seg = trackGraph.getTrackSegmentWithJoints(segmentNumber);
    if (!seg) return null;

    // Filter signals that are ahead of currentT in the travel direction
    // and face the same direction we're traveling
    const candidates: { signal: typeof signals[number]; distAhead: number }[] = [];

    for (const signal of signals) {
      if (signal.direction !== direction) continue;

      let isAhead: boolean;
      if (direction === 'tangent') {
        isAhead = signal.tValue > currentT + 1e-9;
      } else {
        isAhead = signal.tValue < currentT - 1e-9;
      }
      if (!isAhead) continue;

      // Arc-length distance from currentT to signal
      const currentLen = seg.curve.lengthAtT(currentT);
      const signalLen = seg.curve.lengthAtT(signal.tValue);
      const dist = Math.abs(signalLen - currentLen);

      candidates.push({ signal, distAhead: dist });
    }

    // Sort by distance ascending (nearest first)
    candidates.sort((a, b) => a.distAhead - b.distAhead);

    for (const { signal, distAhead } of candidates) {
      const aspect = this.getAspect(signal.id);
      if (aspect === 'red' || aspect === 'yellow') {
        return {
          distance: baseDistance + distAhead,
          aspect,
          signalId: signal.id,
        };
      }
      // GREEN signal — continue looking further
    }

    return null;
  }

  /**
   * Check whether any train on a partial segment has its position or bogies
   * within the given t-range.
   */
  private _isPartialSegmentOccupied(
    segmentNumber: number,
    fromT: number,
    toT: number,
    trainsOnSeg: ReadonlySet<number>,
    placedTrains: readonly PlacedTrainEntry[],
  ): boolean {
    for (const { id, train } of placedTrains) {
      if (!trainsOnSeg.has(id)) continue;

      // Check head position
      const pos = train.position;
      if (
        pos &&
        pos.trackSegment === segmentNumber &&
        pos.tValue >= fromT &&
        pos.tValue <= toT
      ) {
        return true;
      }

      // Check bogie positions
      const bogies = train.getBogiePositions();
      if (bogies) {
        for (const bogie of bogies) {
          if (
            bogie.trackSegment === segmentNumber &&
            bogie.tValue >= fromT &&
            bogie.tValue <= toT
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }
}

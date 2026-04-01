/**
 * Manages signal placements and block definitions.
 *
 * @remarks
 * Provides CRUD operations for signals and blocks, maintains lookup indexes
 * for efficient queries, and handles serialization/deserialization.
 *
 * @module signals/block-signal-manager
 */

import type { TrackGraph } from '@/trains/tracks/track';
import type { SegmentSplitInfo } from '@/trains/tracks/track';

import type {
  Block,
  BlockId,
  BlockSegmentEntry,
  SerializedSignalData,
  SignalId,
  SignalPlacement,
} from './types';

/**
 * Central registry for all block signals and their associated blocks.
 *
 * @group Signal System
 */
export class BlockSignalManager {
  private _signals: Map<SignalId, SignalPlacement> = new Map();
  private _blocks: Map<BlockId, Block> = new Map();

  /** segment number → signals on that segment (kept sorted by tValue) */
  private _segmentToSignals: Map<number, SignalPlacement[]> = new Map();

  /** entry signal ID → block protected by that signal */
  private _entrySignalToBlock: Map<SignalId, BlockId> = new Map();

  /** exit signal ID → block that ends at that signal */
  private _exitSignalToBlock: Map<SignalId, BlockId> = new Map();

  private _nextSignalId: SignalId = 1;
  private _nextBlockId: BlockId = 1;

  // -----------------------------------------------------------------------
  // Signal CRUD
  // -----------------------------------------------------------------------

  /**
   * Place a new signal on a track segment.
   *
   * @param segmentNumber - The segment to place the signal on.
   * @param tValue - Parametric position along the curve (0–1).
   * @param direction - Direction the signal faces.
   * @returns The new signal's ID.
   */
  addSignal(
    segmentNumber: number,
    tValue: number,
    direction: 'tangent' | 'reverseTangent',
  ): SignalId {
    if (tValue < 0 || tValue > 1) {
      throw new RangeError(
        `Signal tValue must be in [0, 1], got ${tValue}`,
      );
    }
    const id = this._nextSignalId++;
    const signal: SignalPlacement = { id, segmentNumber, tValue, direction };
    this._signals.set(id, signal);
    this._addToSegmentIndex(signal);
    return id;
  }

  /**
   * Remove a signal and any blocks that reference it.
   *
   * @param id - Signal ID to remove.
   */
  removeSignal(id: SignalId): void {
    const signal = this._signals.get(id);
    if (!signal) return;

    // Remove blocks that use this signal as entry or exit
    const entryBlockId = this._entrySignalToBlock.get(id);
    if (entryBlockId !== undefined) {
      this.removeBlock(entryBlockId);
    }
    const exitBlockId = this._exitSignalToBlock.get(id);
    if (exitBlockId !== undefined) {
      // Detach exit reference rather than deleting the whole block
      const block = this._blocks.get(exitBlockId);
      if (block) {
        block.exitSignalId = null;
        this._exitSignalToBlock.delete(id);
      }
    }

    this._removeFromSegmentIndex(signal);
    this._signals.delete(id);
  }

  /** Get a signal by ID. */
  getSignal(id: SignalId): SignalPlacement | null {
    return this._signals.get(id) ?? null;
  }

  /** Get all signals. */
  getSignals(): ReadonlyMap<SignalId, SignalPlacement> {
    return this._signals;
  }

  /**
   * Get all signals placed on a given segment, sorted by ascending tValue.
   */
  getSignalsOnSegment(segmentNumber: number): readonly SignalPlacement[] {
    return this._segmentToSignals.get(segmentNumber) ?? [];
  }

  // -----------------------------------------------------------------------
  // Block CRUD
  // -----------------------------------------------------------------------

  /**
   * Define a new block.
   *
   * @param entrySignalId - Signal at the block's entry.
   * @param exitSignalId - Signal at the block's exit, or `null`.
   * @param segments - Ordered segment entries (first/last may be partial).
   * @returns The new block's ID.
   */
  addBlock(
    entrySignalId: SignalId,
    exitSignalId: SignalId | null,
    segments: BlockSegmentEntry[],
  ): BlockId {
    const id = this._nextBlockId++;
    const block: Block = { id, entrySignalId, exitSignalId, segments };
    this._blocks.set(id, block);
    this._entrySignalToBlock.set(entrySignalId, id);
    if (exitSignalId !== null) {
      this._exitSignalToBlock.set(exitSignalId, id);
    }
    return id;
  }

  /**
   * Remove a block by ID.
   */
  removeBlock(id: BlockId): void {
    const block = this._blocks.get(id);
    if (!block) return;

    this._entrySignalToBlock.delete(block.entrySignalId);
    if (block.exitSignalId !== null) {
      this._exitSignalToBlock.delete(block.exitSignalId);
    }
    this._blocks.delete(id);
  }

  /** Get a block by ID. */
  getBlock(id: BlockId): Block | null {
    return this._blocks.get(id) ?? null;
  }

  /** Get all blocks. */
  getBlocks(): ReadonlyMap<BlockId, Block> {
    return this._blocks;
  }

  /** Get the block protected by a given entry signal. */
  getBlockByEntrySignal(signalId: SignalId): Block | null {
    const blockId = this._entrySignalToBlock.get(signalId);
    if (blockId === undefined) return null;
    return this._blocks.get(blockId) ?? null;
  }

  /**
   * Get the next block downstream from a given block
   * (the block whose entry signal is this block's exit signal).
   */
  getNextBlockAfter(blockId: BlockId): Block | null {
    const block = this._blocks.get(blockId);
    if (!block || block.exitSignalId === null) return null;
    return this.getBlockByEntrySignal(block.exitSignalId);
  }

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  /** Serialize all signals and blocks to plain data. */
  serialize(): SerializedSignalData {
    return {
      signals: Array.from(this._signals.values()),
      blocks: Array.from(this._blocks.values()),
    };
  }

  /**
   * Restore signals and blocks from serialized data.
   * Clears any existing state first.
   */
  deserialize(data: SerializedSignalData): void {
    this._signals.clear();
    this._blocks.clear();
    this._segmentToSignals.clear();
    this._entrySignalToBlock.clear();
    this._exitSignalToBlock.clear();

    let maxSignalId = 0;
    for (const signal of data.signals) {
      this._signals.set(signal.id, signal);
      this._addToSegmentIndex(signal);
      if (signal.id >= maxSignalId) maxSignalId = signal.id;
    }
    this._nextSignalId = maxSignalId + 1;

    let maxBlockId = 0;
    for (const block of data.blocks) {
      this._blocks.set(block.id, block);
      this._entrySignalToBlock.set(block.entrySignalId, block.id);
      if (block.exitSignalId !== null) {
        this._exitSignalToBlock.set(block.exitSignalId, block.id);
      }
      if (block.id >= maxBlockId) maxBlockId = block.id;
    }
    this._nextBlockId = maxBlockId + 1;
  }

  // -----------------------------------------------------------------------
  // Auto-fill: compute block segments between two signals
  // -----------------------------------------------------------------------

  /**
   * Walk the track graph from entry signal to exit signal and compute the
   * ordered list of block segment entries (with partial ranges at boundaries).
   *
   * @returns The computed segments, or `null` if no path is found.
   */
  computeBlockSegments(
    entrySignalId: SignalId,
    exitSignalId: SignalId,
    trackGraph: TrackGraph,
  ): BlockSegmentEntry[] | null {
    const entrySig = this._signals.get(entrySignalId);
    const exitSig = this._signals.get(exitSignalId);
    if (!entrySig || !exitSig) return null;

    // Same segment — single partial entry
    if (entrySig.segmentNumber === exitSig.segmentNumber) {
      const fromT = Math.min(entrySig.tValue, exitSig.tValue);
      const toT = Math.max(entrySig.tValue, exitSig.tValue);
      if (fromT === toT) return null;
      return [{ segmentNumber: entrySig.segmentNumber, fromT, toT }];
    }

    const startSeg = trackGraph.getTrackSegmentWithJoints(entrySig.segmentNumber);
    if (!startSeg) return null;

    // Determine exit joint of the entry signal's segment (in the signal's facing direction)
    const exitJointNum =
      entrySig.direction === 'tangent' ? startSeg.t1Joint : startSeg.t0Joint;

    // BFS: walk from exitJointNum through joints until we reach the exit signal's segment
    // Each BFS node: { jointNumber, arrivalDirection, parentJoint, viaSegment }
    type BfsNode = {
      jointNumber: number;
      arrivalDir: 'tangent' | 'reverseTangent';
      parentJoint: number | null;
      viaSegment: number | null;
    };

    const visited = new Set<number>(); // visited joint numbers
    const queue: BfsNode[] = [];
    const parentMap = new Map<number, BfsNode>();

    // Seed: the exit joint of the starting segment
    // Determine direction at exitJoint: if we arrived via the entry segment,
    // figure out which direction set contains the entry joint
    const entryJointNum =
      entrySig.direction === 'tangent' ? startSeg.t0Joint : startSeg.t1Joint;
    const exitJoint = trackGraph.getJoint(exitJointNum);
    if (!exitJoint) return null;

    const seedDir: 'tangent' | 'reverseTangent' =
      exitJoint.direction.reverseTangent.has(entryJointNum)
        ? 'tangent'
        : 'reverseTangent';

    const seedNode: BfsNode = {
      jointNumber: exitJointNum,
      arrivalDir: seedDir,
      parentJoint: null,
      viaSegment: null,
    };
    queue.push(seedNode);
    parentMap.set(exitJointNum, seedNode);
    visited.add(exitJointNum);

    let foundNode: BfsNode | null = null;
    let foundSegDir: 'tangent' | 'reverseTangent' = 'tangent';
    const MAX_STEPS = 100;
    /** Maximum cumulative arc-length (world units) before aborting the search. */
    const MAX_ARC_LENGTH = 5000;
    let steps = 0;
    let totalArcLength = 0;

    while (queue.length > 0 && steps < MAX_STEPS && totalArcLength < MAX_ARC_LENGTH) {
      steps++;
      const current = queue.shift()!;
      const joint = trackGraph.getJoint(current.jointNumber);
      if (!joint) continue;

      const nextJoints = joint.direction[current.arrivalDir];
      for (const nextJointNum of nextJoints) {
        if (visited.has(nextJointNum)) continue;

        const segNum = joint.connections.get(nextJointNum);
        if (segNum === undefined) continue;

        // Accumulate arc-length for the distance bound
        const segData = trackGraph.getTrackSegmentWithJoints(segNum);
        if (segData) {
          totalArcLength += segData.curve.fullLength;
        }

        // Check if this segment is the exit signal's segment
        if (segNum === exitSig.segmentNumber) {
          const node: BfsNode = {
            jointNumber: nextJointNum,
            arrivalDir: 'tangent', // placeholder, not needed for reconstruction
            parentJoint: current.jointNumber,
            viaSegment: segNum,
          };
          parentMap.set(nextJointNum, node);
          foundNode = node;

          // Determine travel direction on the exit segment
          const exitSegData = trackGraph.getTrackSegmentWithJoints(segNum);
          if (exitSegData) {
            foundSegDir = exitSegData.t0Joint === current.jointNumber ? 'tangent' : 'reverseTangent';
          }
          break;
        }

        // Determine direction at nextJoint for continuing the walk
        const nextJoint = trackGraph.getJoint(nextJointNum);
        if (!nextJoint) continue;

        const nextDir: 'tangent' | 'reverseTangent' =
          nextJoint.direction.reverseTangent.has(current.jointNumber)
            ? 'tangent'
            : 'reverseTangent';

        const node: BfsNode = {
          jointNumber: nextJointNum,
          arrivalDir: nextDir,
          parentJoint: current.jointNumber,
          viaSegment: segNum,
        };
        queue.push(node);
        parentMap.set(nextJointNum, node);
        visited.add(nextJointNum);
      }

      if (foundNode) break;
    }

    if (!foundNode) return null;

    // Reconstruct the path of segment numbers (excluding entry and exit partial segments)
    const intermediateSegments: number[] = [];
    let cur = foundNode;
    while (cur.viaSegment !== null) {
      intermediateSegments.unshift(cur.viaSegment);
      if (cur.parentJoint === null) break;
      cur = parentMap.get(cur.parentJoint)!;
    }

    // Build the result
    const result: BlockSegmentEntry[] = [];

    // First entry: partial segment from entry signal
    if (entrySig.direction === 'tangent') {
      result.push({ segmentNumber: entrySig.segmentNumber, fromT: entrySig.tValue, toT: 1 });
    } else {
      result.push({ segmentNumber: entrySig.segmentNumber, fromT: 0, toT: entrySig.tValue });
    }

    // Intermediate full segments (skip first since it's the entry segment's partial)
    for (const segNum of intermediateSegments) {
      if (segNum === exitSig.segmentNumber) continue; // handled below
      if (segNum === entrySig.segmentNumber) continue; // already handled above
      result.push({ segmentNumber: segNum, fromT: 0, toT: 1 });
    }

    // Last entry: partial segment to exit signal
    if (foundSegDir === 'tangent') {
      result.push({ segmentNumber: exitSig.segmentNumber, fromT: 0, toT: exitSig.tValue });
    } else {
      result.push({ segmentNumber: exitSig.segmentNumber, fromT: exitSig.tValue, toT: 1 });
    }

    return result;
  }

  // -----------------------------------------------------------------------
  // Track mutation handlers
  // -----------------------------------------------------------------------

  /**
   * Handle a track segment being removed. Removes signals on that segment
   * and cleans up block segment entries referencing it.
   */
  handleSegmentRemoved(segmentNumber: number): void {
    // Remove all signals on the deleted segment
    const signalsOnSeg = this._segmentToSignals.get(segmentNumber);
    if (signalsOnSeg) {
      // Copy the array since removeSignal mutates the index
      for (const signal of [...signalsOnSeg]) {
        this.removeSignal(signal.id);
      }
    }

    // Remove block segment entries referencing the deleted segment
    for (const [blockId, block] of this._blocks) {
      const before = block.segments.length;
      block.segments = block.segments.filter(
        (e) => e.segmentNumber !== segmentNumber,
      );
      if (block.segments.length === 0) {
        this.removeBlock(blockId);
      }
    }
  }

  /**
   * Handle a track segment being split. Remaps signals and block segment
   * entries from the old segment number to the two new segment numbers.
   *
   * @remarks
   * When segment `old` is split at `splitT`:
   * - `firstNewSegment` covers the range [0, splitT] of the original → remapped to [0, 1]
   * - `secondNewSegment` covers the range [splitT, 1] of the original → remapped to [0, 1]
   */
  handleSegmentSplit(info: SegmentSplitInfo): void {
    const { oldSegmentNumber, splitT, firstNewSegment, secondNewSegment } = info;

    // --- Remap signals ---
    const signalsOnOld = this._segmentToSignals.get(oldSegmentNumber);
    if (signalsOnOld) {
      for (const signal of [...signalsOnOld]) {
        this._removeFromSegmentIndex(signal);
        if (signal.tValue <= splitT) {
          // Falls in the first new segment
          signal.segmentNumber = firstNewSegment;
          signal.tValue = splitT > 0 ? signal.tValue / splitT : 0;
        } else {
          // Falls in the second new segment
          signal.segmentNumber = secondNewSegment;
          signal.tValue =
            splitT < 1 ? (signal.tValue - splitT) / (1 - splitT) : 1;
        }
        this._addToSegmentIndex(signal);
      }
    }

    // --- Remap block segment entries ---
    for (const [, block] of this._blocks) {
      const newSegments: BlockSegmentEntry[] = [];
      for (const entry of block.segments) {
        if (entry.segmentNumber !== oldSegmentNumber) {
          newSegments.push(entry);
          continue;
        }

        // Remap the entry's [fromT, toT] range through the split
        if (entry.toT <= splitT) {
          // Entire range falls in the first new segment
          newSegments.push({
            segmentNumber: firstNewSegment,
            fromT: splitT > 0 ? entry.fromT / splitT : 0,
            toT: splitT > 0 ? entry.toT / splitT : 0,
          });
        } else if (entry.fromT >= splitT) {
          // Entire range falls in the second new segment
          const denom = 1 - splitT;
          newSegments.push({
            segmentNumber: secondNewSegment,
            fromT: denom > 0 ? (entry.fromT - splitT) / denom : 0,
            toT: denom > 0 ? (entry.toT - splitT) / denom : 1,
          });
        } else {
          // Range spans the split — produce two entries
          newSegments.push({
            segmentNumber: firstNewSegment,
            fromT: splitT > 0 ? entry.fromT / splitT : 0,
            toT: 1,
          });
          const denom = 1 - splitT;
          newSegments.push({
            segmentNumber: secondNewSegment,
            fromT: 0,
            toT: denom > 0 ? (entry.toT - splitT) / denom : 1,
          });
        }
      }
      block.segments = newSegments;
    }
  }

  // -----------------------------------------------------------------------
  // Internal index helpers
  // -----------------------------------------------------------------------

  private _addToSegmentIndex(signal: SignalPlacement): void {
    let list = this._segmentToSignals.get(signal.segmentNumber);
    if (!list) {
      list = [];
      this._segmentToSignals.set(signal.segmentNumber, list);
    }
    list.push(signal);
    list.sort((a, b) => a.tValue - b.tValue);
  }

  private _removeFromSegmentIndex(signal: SignalPlacement): void {
    const list = this._segmentToSignals.get(signal.segmentNumber);
    if (!list) return;
    const idx = list.indexOf(signal);
    if (idx !== -1) list.splice(idx, 1);
    if (list.length === 0) {
      this._segmentToSignals.delete(signal.segmentNumber);
    }
  }
}

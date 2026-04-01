/**
 * Type definitions for the block signal system.
 *
 * @remarks
 * Signals can be placed at any point along a track segment (not just at joints).
 * A block is a contiguous stretch of track between two signals, defined as an
 * ordered list of segment entries that may be partial at the boundaries.
 *
 * @module signals/types
 */

// ---------------------------------------------------------------------------
// Branded IDs
// ---------------------------------------------------------------------------

/** Unique identifier for a signal. */
export type SignalId = number;

/** Unique identifier for a block. */
export type BlockId = number;

// ---------------------------------------------------------------------------
// Signal
// ---------------------------------------------------------------------------

/** The three possible signal indications. */
export type SignalAspect = 'green' | 'yellow' | 'red';

/**
 * A signal placed at a specific point along a track segment.
 *
 * @remarks
 * The signal faces a `direction` — it protects the block that lies ahead
 * in that direction.  For example, a signal at `tValue = 0.6` facing
 * `'tangent'` protects the stretch of track from `t = 0.6` onward (toward
 * `t = 1` and beyond through subsequent segments).
 */
export type SignalPlacement = {
  /** Unique signal identifier. */
  id: SignalId;
  /** The track segment this signal sits on. */
  segmentNumber: number;
  /** Parametric position along the segment's bezier curve (0–1). */
  tValue: number;
  /** Direction the signal faces — the protected block is ahead in this direction. */
  direction: 'tangent' | 'reverseTangent';
};

// ---------------------------------------------------------------------------
// Block
// ---------------------------------------------------------------------------

/**
 * One segment (or partial segment) within a block.
 *
 * @remarks
 * `fromT` and `toT` define the parametric range of this segment that belongs
 * to the block.  For interior segments both are 0 and 1 respectively.  For
 * boundary segments where a signal sits mid-segment, one end will be the
 * signal's `tValue`.  Invariant: `fromT < toT`.
 */
export type BlockSegmentEntry = {
  /** Track segment number. */
  segmentNumber: number;
  /** Start of the range within the segment (inclusive). */
  fromT: number;
  /** End of the range within the segment (inclusive). */
  toT: number;
};

/**
 * A block — a contiguous stretch of track between two signals.
 *
 * @remarks
 * The entry signal protects this block: when the block is occupied the entry
 * signal shows RED.  The exit signal (if any) is the entry signal of the
 * next block downstream.
 */
export type Block = {
  /** Unique block identifier. */
  id: BlockId;
  /** Signal at the start of this block. */
  entrySignalId: SignalId;
  /** Signal at the end of this block, or `null` if the block terminates at track end. */
  exitSignalId: SignalId | null;
  /** Ordered list of segment entries within this block (first/last may be partial). */
  segments: BlockSegmentEntry[];
};

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/** Serialized form of the entire signal/block dataset. */
export type SerializedSignalData = {
  signals: SignalPlacement[];
  blocks: Block[];
};

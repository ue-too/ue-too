# Track-Aligned Platforms Design

## Overview

Add the ability to place station platforms that conform to existing curved tracks in the banana railway simulation. Platforms follow the track geometry (BCurve-based segments) rather than being limited to straight, station-owned track segments.

Two variants are supported:

- **Single-spine**: one edge follows a track, the other is a user-drawn polygon outline.
- **Dual-spine**: both edges follow separate parallel tracks, with user-drawn end caps connecting them (curved island platform on existing tracks).

Platforms are associated with stations. Stations can now exist without any platforms (bare stations), and the existing island station tool remains unchanged.

## Data Model

### TrackAlignedPlatform

A new entity type, managed separately from the existing `Platform` type.

```typescript
type TrackAlignedPlatform = {
    id: number;
    stationId: number; // required — every track-aligned platform belongs to a station

    // Ordered list of connected track segments forming the platform's track-side edge.
    // For dual-spine platforms, this is spine A.
    spineA: SpineEntry[];

    // Second spine (dual-spine only). null for single-spine platforms.
    spineB: SpineEntry[] | null;

    // Offset from track centerline to the platform's track-facing edge (meters).
    // Accounts for gauge, ballast, car body half-width, and clearance.
    offset: number;

    // User-placed vertices defining the non-track side(s) of the platform polygon.
    // Single-spine: connects spine start anchor to spine end anchor (the outer edge).
    // Dual-spine: two end caps connecting the four spine anchors.
    outerVertices: OuterVertices;

    stopPositions: StopPosition[];
};

type SpineEntry = {
    trackSegment: number; // segment ID
    tStart: number;       // 0-1, entry point on this segment
    tEnd: number;         // 0-1, exit point on this segment
    side: 1 | -1;         // which side of this segment's curve the platform is on
                          // (per-segment because curve direction can flip at joints)
};

// Discriminated union for the two platform variants.
type OuterVertices =
    | { kind: 'single'; vertices: Point[] }      // polyline from spine end anchor back to spine start anchor
    | { kind: 'dual'; capA: Point[]; capB: Point[] }; // two end caps connecting the four spine anchors
```

### Station Changes

The existing `Station` type gains a new field:

```typescript
type Station = {
    // ... existing fields unchanged ...
    trackAlignedPlatforms: number[]; // IDs of TrackAlignedPlatform entities
};
```

Bare stations (no platforms of either kind) are valid.

### Serialization

`SerializedTrackAlignedPlatform` mirrors the runtime type with JSON-safe fields. Added to `SerializedStationData` alongside existing station serialization.

## Platform Offset

The offset from track centerline to the platform edge must clear the track infrastructure and rolling stock:

```
offset = max(ballastHalfWidth, bedWidth / 2) + clearance + carHalfWidth
```

- `ballastHalfWidth` / `bedWidth`: derived from the track segment (same logic as catenary pole placement).
- `clearance`: small safety gap (default ~0.15m).
- `carHalfWidth`: configurable constant (`DEFAULT_CAR_HALF_WIDTH`, default 1.5m — typical passenger car body is ~3m wide). No per-vehicle car width exists in the codebase yet, so this is a project-wide default for now.

## Constraints

- **Consecutive segments**: spine segments must be connected through shared joints, in order.
- **No branching**: joints along the spine must have exactly 2 connections (no turnouts/switches). If a joint branches, the platform cannot extend through it.
- **Station distance**: the platform's start point must be within a maximum distance from its station's position (default 500m).
- **Track protection**: track segments referenced by a platform cannot be deleted or modified. The user must remove the platform first.
- **Same elevation (dual-spine)**: both spines must be at the same elevation level.
- **Non-self-intersecting end caps (dual-spine)**: the end cap polylines must not create a self-intersecting polygon.

## Placement Interaction

All placement tools follow the `@ue-too/being` state machine architecture.

### Prerequisite

The user selects a station first, then activates the platform placement tool. The station ID is known before placement begins.

### Single-Spine Platform

States: `IDLE` -> `PICK_START` -> `PICK_END` -> `DRAW_OUTER` -> `IDLE`

1. **IDLE -> PICK_START**: tool is active, cursor snaps to nearby track segments. Click to set the start point (segment + t-value). Side is determined by which side of the track the cursor is on. Distance from station is validated.
2. **PICK_START -> PICK_END**: user moves along the track. The tool highlights the spine path, automatically extending through connected non-branching joints. A real-time preview of the track-side edge renders. Click to set the end point.
3. **PICK_END -> DRAW_OUTER**: two anchor points appear (perpendicular to the track at start and end positions). The user clicks to place outer vertices one at a time, forming the polygon's non-track side. Clicking on the closing anchor point (spine start anchor) finalizes the polygon.
4. **Finalize -> IDLE**: platform entity is created, associated with the station, mesh is rendered.

### Dual-Spine Platform

States: `IDLE` -> `PICK_SPINE_A_START` -> `PICK_SPINE_A_END` -> `PICK_SPINE_B_START` -> `PICK_SPINE_B_END` -> `DRAW_END_CAP_1` -> `DRAW_END_CAP_2` -> `IDLE`

1. **Pick spine A**: same as single-spine start/end picking on the first track.
2. **Pick spine B**: same process on the second track. Elevation must match spine A.
3. **DRAW_END_CAP_1**: spine A end anchor and spine B end anchor are highlighted. User clicks vertices to connect them. Clicking on spine B's end anchor closes this cap.
4. **DRAW_END_CAP_2**: spine B start anchor and spine A start anchor are highlighted. User clicks vertices to connect them. Clicking on spine A's start anchor closes the polygon and finalizes.

### Cancellation

Escape at any state returns to IDLE, discarding in-progress placement.

## Rendering

### Mesh Construction

The platform is a closed polygon composed of:

**Single-spine:**
- Track-side edge: sampled from spine curves, offset by platform offset along the per-segment normal.
- Outer edge: the user's polyline vertices.

**Dual-spine:**
- Spine A track-side edge (sampled, offset).
- End cap 1 vertices.
- Spine B track-side edge (sampled, offset, reversed direction).
- End cap 2 vertices.

The closed polygon is triangulated using a polygon triangulation library (earcut or equivalent — not currently in the codebase, needs to be added).

### Texture

Reuses the existing platform texture (concrete surface with yellow safety line). The safety line is rendered on the track-facing edge(s). UV mapping tiles the texture along the track direction.

### Elevation

Platforms are placed in the elevation band matching their station's elevation, above the track ballast in the drawable sublayer (same as existing platform rendering).

### Joint Transitions

At segment boundaries, the renderer must stitch the sampled points smoothly. The end of one segment's samples and the start of the next should meet at the joint position to avoid gaps or discontinuities in the mesh.

## Entity Management

### TrackAlignedPlatformManager

New manager following the `GenericEntityManager` pattern:

- CRUD: create, get, update, destroy.
- Lookup by station ID: which platforms belong to a station.
- Lookup by track segment ID: which platforms reference a segment (used by the track protection guard).
- Serialization / deserialization.

### Track Protection

When a user attempts to delete or modify a track segment:
1. Query `TrackAlignedPlatformManager` for any platforms referencing that segment.
2. If found, block the action and display a message indicating which platform/station is attached.

### Station Deletion

Deleting a station also deletes all its track-aligned platforms.

## Tool Integration

Three new capabilities added to the tool switcher:

1. **Create bare station**: place a station marker (name + position + elevation) without platforms.
2. **Add single-spine platform**: activated after selecting a station. Follows the single-spine placement flow.
3. **Add dual-spine platform**: activated after selecting a station. Follows the dual-spine placement flow.

The existing island station tool is unchanged.

## Dependencies

- **Polygon triangulation library**: earcut or equivalent, needed for meshing arbitrary platform polygons. Must be added to the project.
- **Existing systems used**: `TrackGraph` (curve access, joint connectivity), `WorldRenderSystem` (elevation bands), `StationManager` (station association), `@ue-too/being` (state machines).

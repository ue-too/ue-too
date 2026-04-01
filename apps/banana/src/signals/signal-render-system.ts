/**
 * Pixi.js rendering of block signals using sprites.
 *
 * @remarks
 * At initialization, draws each signal aspect variant (red, yellow, green)
 * once with {@link Graphics}, then converts to reusable {@link Texture}
 * objects via `generateTexture()`.  Each placed signal gets a {@link Sprite}
 * whose texture is swapped each frame to match the current aspect.
 *
 * @module signals/signal-render-system
 */

import { Container, Graphics, Sprite, Texture } from 'pixi.js';

import type { WorldRenderSystem } from '@/world-render-system';
import type { TrackGraph } from '@/trains/tracks/track';
import { ELEVATION } from '@/trains/tracks/types';
import type { TrackTextureRenderer } from '@/trains/tracks/render-system';

import type { BlockSignalManager } from './block-signal-manager';
import type { SignalStateEngine } from './signal-state-engine';
import type { SignalId, SignalPlacement } from './types';

// ---------------------------------------------------------------------------
// Visual constants
// ---------------------------------------------------------------------------

/** Signal post height in world units. */
const POST_HEIGHT = 1.2;
/** Radius of each aspect light in world units. */
const LIGHT_RADIUS = 0.15;
/** Spacing between light centers. */
const LIGHT_SPACING = 0.35;
/** Perpendicular offset from track center (left of travel direction). */
const TRACK_OFFSET = 1.0;

/** Colors for each aspect state. */
const ASPECT_COLORS = {
  red:    { active: 0xff2222, dim: 0x330000 },
  yellow: { active: 0xffcc00, dim: 0x332200 },
  green:  { active: 0x22ff22, dim: 0x003300 },
} as const;

/** Resolution multiplier for generated textures. */
const TEXTURE_RESOLUTION = 2;

/**
 * Manages rendering of signal indicators on the track canvas.
 *
 * @group Signal System
 */
export class SignalRenderSystem {
  private _worldRenderSystem: WorldRenderSystem;
  private _trackGraph: TrackGraph;
  private _bsm: BlockSignalManager;
  private _signalStateEngine: SignalStateEngine;

  /** Pre-generated textures for each aspect. */
  private _textures: Record<'red' | 'yellow' | 'green', Texture> | null = null;

  /** Active sprites keyed by signal ID. */
  private _sprites: Map<SignalId, { sprite: Sprite; container: Container; currentAspect: string }> = new Map();

  private _textureRenderer: TrackTextureRenderer | null;

  constructor(
    worldRenderSystem: WorldRenderSystem,
    trackGraph: TrackGraph,
    blockSignalManager: BlockSignalManager,
    signalStateEngine: SignalStateEngine,
    textureRenderer?: TrackTextureRenderer | null,
  ) {
    this._worldRenderSystem = worldRenderSystem;
    this._trackGraph = trackGraph;
    this._bsm = blockSignalManager;
    this._signalStateEngine = signalStateEngine;
    this._textureRenderer = textureRenderer ?? null;
  }

  /**
   * Update all signal visuals.  Call once per frame after
   * {@link SignalStateEngine.update}.
   */
  update(): void {
    this._ensureTextures();

    const signals = this._bsm.getSignals();

    // Remove sprites for signals that no longer exist
    for (const [id] of this._sprites) {
      if (!signals.has(id)) {
        this._removeSprite(id);
      }
    }

    // Add/update sprites for all signals
    for (const [id, signal] of signals) {
      if (!this._sprites.has(id)) {
        this._addSprite(signal);
      }
      this._updateSpriteAspect(id);
    }
  }

  /** Remove all signal sprites and dispose textures. */
  dispose(): void {
    for (const [id] of this._sprites) {
      this._removeSprite(id);
    }
    if (this._textures) {
      this._textures.red.destroy(true);
      this._textures.yellow.destroy(true);
      this._textures.green.destroy(true);
      this._textures = null;
    }
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private _ensureTextures(): void {
    if (this._textures) return;
    const renderer = this._textureRenderer?.renderer?.textureGenerator;
    if (!renderer) return;

    this._textures = {
      red: this._generateAspectTexture(renderer, 'red'),
      yellow: this._generateAspectTexture(renderer, 'yellow'),
      green: this._generateAspectTexture(renderer, 'green'),
    };
  }

  /**
   * Draw a signal post graphic with the given aspect active, then convert
   * to a texture.
   */
  private _generateAspectTexture(
    renderer: { generateTexture: (options: { target: Container; resolution?: number }) => Texture },
    activeAspect: 'red' | 'yellow' | 'green',
  ): Texture {
    const g = new Graphics();

    // Post body (thin rectangle)
    const postWidth = LIGHT_RADIUS * 0.5;
    g.rect(-postWidth / 2, 0, postWidth, POST_HEIGHT);
    g.fill(0x444444);

    // Background plate behind lights
    const plateW = LIGHT_RADIUS * 3;
    const plateH = LIGHT_SPACING * 2 + LIGHT_RADIUS * 2.5;
    const plateY = POST_HEIGHT - plateH - LIGHT_RADIUS * 0.5;
    g.roundRect(-plateW / 2, plateY, plateW, plateH, LIGHT_RADIUS * 0.5);
    g.fill(0x222222);

    // Lights (top=red, middle=yellow, bottom=green)
    const aspects: ('red' | 'yellow' | 'green')[] = ['red', 'yellow', 'green'];
    for (let i = 0; i < 3; i++) {
      const aspect = aspects[i];
      const cy = POST_HEIGHT - LIGHT_RADIUS * 1.5 - i * LIGHT_SPACING;
      const color =
        aspect === activeAspect
          ? ASPECT_COLORS[aspect].active
          : ASPECT_COLORS[aspect].dim;
      g.circle(0, cy, LIGHT_RADIUS);
      g.fill(color);
    }

    const texture = renderer.generateTexture({ target: g, resolution: TEXTURE_RESOLUTION });
    g.destroy();
    return texture;
  }

  private _addSprite(signal: SignalPlacement): void {
    if (!this._textures) return;

    const seg = this._trackGraph.getTrackSegmentWithJoints(signal.segmentNumber);
    if (!seg) {
      console.warn(
        `[SignalRenderSystem] Signal #${signal.id} references non-existent segment ${signal.segmentNumber}`,
      );
      return;
    }

    const point = seg.curve.get(signal.tValue);
    const tangent = seg.curve.derivative(signal.tValue);

    // Normalize tangent
    const len = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
    if (len === 0) return;
    const tx = tangent.x / len;
    const ty = tangent.y / len;

    // Perpendicular (left of travel direction for the signal's facing direction)
    let px: number, py: number;
    if (signal.direction === 'tangent') {
      // Left of tangent direction: rotate tangent -90°
      px = ty;
      py = -tx;
    } else {
      // Left of reverse-tangent direction: rotate tangent +90°
      px = -ty;
      py = tx;
    }

    const aspect = this._signalStateEngine.getAspect(signal.id);
    const texture = this._textures[aspect];

    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 1); // bottom-center pivot
    sprite.x = point.x + px * TRACK_OFFSET;
    sprite.y = point.y + py * TRACK_OFFSET;

    // Rotate sprite to align with track tangent
    const angle = Math.atan2(ty, tx);
    sprite.rotation = angle - Math.PI / 2; // sprite points "up", so subtract 90°

    // Scale to world units (texture is in pixels, we need world-unit size)
    const desiredHeight = POST_HEIGHT;
    sprite.scale.set(desiredHeight / (texture.height / TEXTURE_RESOLUTION));

    const container = new Container();
    container.addChild(sprite);

    // Determine elevation band — use GROUND as default
    const bandIndex = this._worldRenderSystem.getElevationBandIndex(
      ELEVATION.GROUND,
    );

    const key = `signal-${signal.id}`;
    this._worldRenderSystem.addToBand(key, container, bandIndex, 'onTrack');
    this._sprites.set(signal.id, { sprite, container, currentAspect: aspect });
  }

  private _updateSpriteAspect(signalId: SignalId): void {
    const entry = this._sprites.get(signalId);
    if (!entry || !this._textures) return;

    const aspect = this._signalStateEngine.getAspect(signalId);
    if (entry.currentAspect === aspect) return;

    entry.sprite.texture = this._textures[aspect];
    entry.currentAspect = aspect;
  }

  private _removeSprite(signalId: SignalId): void {
    const entry = this._sprites.get(signalId);
    if (!entry) return;

    const key = `signal-${signalId}`;
    this._worldRenderSystem.removeFromBand(key);
    entry.container.destroy({ children: true });
    this._sprites.delete(signalId);
  }
}

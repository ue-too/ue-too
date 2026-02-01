/**
 * Raw input parser module exports.
 *
 * @remarks
 * This module provides DOM event parsers that listen to browser events and convert them
 * into input events for the state machines. Separate parsers handle KMT and touch input.
 *
 * ## Components
 *
 * - **{@link VanillaKMTEventParser}**: Parses keyboard, mouse, and trackpad DOM events
 * - **{@link VanillaTouchEventParser}**: Parses touch DOM events
 *
 * Parsers attach to canvas elements and forward events to their respective state machines.
 *
 * @see {@link VanillaKMTEventParser} for KMT event parsing
 * @see {@link VanillaTouchEventParser} for touch event parsing
 *
 * @module
 */

export * from './vanilla-kmt-event-parser';
export * from './vanilla-touch-event-parser';

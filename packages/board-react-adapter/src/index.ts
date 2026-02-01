/**
 * @packageDocumentation
 * React adapter for the @ue-too/board infinite canvas library.
 *
 * @remarks
 * This package provides React components and hooks to integrate the @ue-too/board
 * infinite canvas into React applications. It handles lifecycle management, state
 * synchronization, and provides idiomatic React patterns for working with the board.
 *
 * ## Core Components
 *
 * - **{@link Board}**: Main component that renders the canvas and manages the board instance
 * - **{@link BoardProvider}**: Context provider for sharing board across components
 *
 * ## State Hooks
 *
 * - **{@link useBoardCameraState}**: Subscribe to specific camera state (position, rotation, zoomLevel)
 * - **{@link useAllBoardCameraState}**: Subscribe to all camera state at once
 * - **{@link useBoard}**: Access the board instance from context
 * - **{@link useBoardCamera}**: Access the camera instance from context
 *
 * ## Control Hooks
 *
 * - **{@link useCameraInput}**: Get camera control functions (pan, zoom, rotate)
 * - **{@link useCustomCameraMux}**: Set a custom camera multiplexer
 * - **{@link useBoardify}**: Create a standalone board instance (alternative to provider)
 *
 * ## Animation Hooks
 *
 * - **{@link useAnimationFrame}**: Generic animation frame hook
 * - **{@link useAnimationFrameWithBoard}**: Animation loop integrated with board.step()
 *
 * ## Key Features
 *
 * - **Automatic State Sync**: Camera state changes trigger React re-renders
 * - **Performance Optimized**: Uses `useSyncExternalStore` for efficient subscriptions
 * - **Type-Safe**: Full TypeScript support with type inference
 * - **Context-Based**: Share board instance across component tree
 * - **Lifecycle Management**: Automatic cleanup and resource management
 *
 * @example
 * Basic usage
 * ```tsx
 * import Board from '@ue-too/board-react-adapter';
 *
 * function App() {
 *   return (
 *     <Board
 *       width={800}
 *       height={600}
 *       animationCallback={(timestamp, ctx) => {
 *         ctx.fillStyle = 'blue';
 *         ctx.fillRect(0, 0, 100, 100);
 *       }}
 *     />
 *   );
 * }
 * ```
 *
 * @example
 * With camera controls
 * ```tsx
 * import Board, {
 *   useBoardCameraState,
 *   useCameraInput
 * } from '@ue-too/board-react-adapter';
 *
 * function Controls() {
 *   const position = useBoardCameraState('position');
 *   const { panToWorld, zoomTo } = useCameraInput();
 *
 *   return (
 *     <div>
 *       <p>Position: {position.x}, {position.y}</p>
 *       <button onClick={() => panToWorld({ x: 0, y: 0 })}>Center</button>
 *       <button onClick={() => zoomTo(1.0)}>Reset Zoom</button>
 *     </div>
 *   );
 * }
 *
 * function App() {
 *   return (
 *     <Board width={800} height={600}>
 *       <Controls />
 *     </Board>
 *   );
 * }
 * ```
 *
 * @see {@link Board} for the main component
 */

export * from './components/Board';
export * from './hooks';

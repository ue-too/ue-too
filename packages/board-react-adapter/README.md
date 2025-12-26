# @ue-too/board-react-adapter

React adapter for the @ue-too/board infinite canvas library.

[![npm version](https://img.shields.io/npm/v/@ue-too/board-react-adapter.svg)](https://www.npmjs.com/package/@ue-too/board-react-adapter)
[![license](https://img.shields.io/npm/l/@ue-too/board-react-adapter.svg)](https://github.com/ue-too/ue-too/blob/main/LICENSE.txt)

## Overview

`@ue-too/board-react-adapter` provides React components and hooks to integrate the `@ue-too/board` infinite canvas into React applications. It handles lifecycle management, state synchronization, and provides idiomatic React patterns for working with the board.

### Key Features

- **React Components**: `<Board>` component with full lifecycle management
- **State Synchronization**: Camera state changes trigger React re-renders
- **Performance Optimized**: Uses `useSyncExternalStore` for efficient subscriptions
- **Type-Safe Hooks**: Full TypeScript support with type inference
- **Context-Based**: Share board instance across component tree
- **Animation Integration**: Hooks for animation loops integrated with board
- **Camera Controls**: Idiomatic React hooks for pan, zoom, and rotation

## Installation

Using Bun:
```bash
bun add @ue-too/board-react-adapter react react-dom
```

Using npm:
```bash
npm install @ue-too/board-react-adapter react react-dom
```

**Peer Dependencies:**
- React >= 19.0.0
- React-DOM >= 19.0.0

## Quick Start

Here's a simple example creating an infinite canvas with React:

```tsx
import Board from '@ue-too/board-react-adapter';

function App() {
  return (
    <Board
      width={800}
      height={600}
      animationCallback={(timestamp, ctx, camera) => {
        // Clear canvas
        ctx.clearRect(0, 0, 800, 600);

        // Draw a blue square at world origin
        ctx.fillStyle = 'blue';
        ctx.fillRect(0, 0, 100, 100);
      }}
    />
  );
}
```

## Core APIs

### Board Component

Main component that renders the canvas and manages the board instance.

```tsx
<Board
  width={number}
  height={number}
  animationCallback={(timestamp, ctx, camera) => void}
  // Optional props
  className?={string}
  style?={React.CSSProperties}
/>
```

**Props:**
- `width`: Canvas width in pixels
- `height`: Canvas height in pixels
- `animationCallback`: Function called on each frame with timestamp, context, and camera
- `className`: CSS class name for the canvas element
- `style`: Inline styles for the canvas element

**Children:**
The component supports children, which will have access to the board via context.

```tsx
<Board width={800} height={600}>
  <Controls />
  <StatusDisplay />
</Board>
```

### State Hooks

#### `useBoardCameraState(key)`

Subscribe to a specific camera state property.

```tsx
function useBoardCameraState<K extends keyof CameraState>(
  key: K
): CameraState[K];
```

**Example:**
```tsx
function CameraPosition() {
  const position = useBoardCameraState('position');

  return <div>Position: ({position.x.toFixed(0)}, {position.y.toFixed(0)})</div>;
}
```

**Available Keys:**
- `position`: `{ x: number, y: number }` - Camera world position
- `rotation`: `number` - Camera rotation in radians
- `zoomLevel`: `number` - Current zoom level

#### `useAllBoardCameraState()`

Subscribe to all camera state at once.

```tsx
function useAllBoardCameraState(): CameraState;
```

**Example:**
```tsx
function CameraInfo() {
  const camera = useAllBoardCameraState();

  return (
    <div>
      <p>Position: ({camera.position.x}, {camera.position.y})</p>
      <p>Rotation: {camera.rotation}rad</p>
      <p>Zoom: {camera.zoomLevel}x</p>
    </div>
  );
}
```

#### `useBoard()`

Access the board instance from context.

```tsx
function useBoard(): BoardType | null;
```

#### `useBoard Camera()`

Access the camera instance from context.

```tsx
function useBoardCamera(): Camera | null;
```

### Control Hooks

#### `useCameraInput()`

Get camera control functions.

```tsx
function useCameraInput(): {
  panToWorld: (position: Point) => void;
  panByScreen: (offset: Point) => void;
  zoomTo: (level: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  rotateTo: (angle: number) => void;
};
```

**Example:**
```tsx
function Controls() {
  const { panToWorld, zoomTo, rotateTo } = useCameraInput();

  return (
    <div>
      <button onClick={() => panToWorld({ x: 0, y: 0 })}>Center</button>
      <button onClick={() => zoomTo(1.0)}>Reset Zoom</button>
      <button onClick={() => rotateTo(0)}>Reset Rotation</button>
    </div>
  );
}
```

#### `useCustomCameraMux(customMux)`

Set a custom camera multiplexer for advanced camera control.

```tsx
function useCustomCameraMux(
  customMux: CameraMux | undefined
): void;
```

#### `useBoardify(width, height, animationCallback)`

Create a standalone board instance without using the provider pattern.

```tsx
function useBoardify(
  width: number,
  height: number,
  animationCallback: AnimationCallback
): {
  canvas: HTMLCanvasElement | null;
  board: BoardType | null;
};
```

### Animation Hooks

#### `useAnimationFrame(callback)`

Generic animation frame hook.

```tsx
function useAnimationFrame(
  callback: (timestamp: number) => void
): void;
```

**Example:**
```tsx
function AnimatedComponent() {
  const [rotation, setRotation] = useState(0);

  useAnimationFrame((timestamp) => {
    setRotation(timestamp * 0.001); // Rotate based on time
  });

  return <div style={{ transform: `rotate(${rotation}rad)` }}>Spinning</div>;
}
```

#### `useAnimationFrameWithBoard(callback)`

Animation loop integrated with `board.step()`.

```tsx
function useAnimationFrameWithBoard(
  callback: (timestamp: number, ctx: CanvasRenderingContext2D, camera: Camera) => void
): void;
```

## Common Use Cases

### Basic Canvas with Pan and Zoom

```tsx
import Board, { useCameraInput, useBoardCameraState } from '@ue-too/board-react-adapter';

function Controls() {
  const position = useBoardCameraState('position');
  const zoom = useBoardCameraState('zoomLevel');
  const { panToWorld, zoomTo } = useCameraInput();

  return (
    <div style={{ position: 'absolute', top: 10, left: 10 }}>
      <p>Position: ({position.x.toFixed(0)}, {position.y.toFixed(0)})</p>
      <p>Zoom: {zoom.toFixed(2)}x</p>
      <button onClick={() => panToWorld({ x: 0, y: 0 })}>Center</button>
      <button onClick={() => zoomTo(1.0)}>Reset Zoom</button>
    </div>
  );
}

function App() {
  return (
    <Board
      width={800}
      height={600}
      animationCallback={(timestamp, ctx) => {
        ctx.fillStyle = 'lightblue';
        ctx.fillRect(-200, -200, 400, 400);

        ctx.fillStyle = 'red';
        ctx.fillRect(-50, -50, 100, 100);
      }}
    >
      <Controls />
    </Board>
  );
}
```

### Interactive Drawing

```tsx
import Board, { useBoard } from '@ue-too/board-react-adapter';
import { useState } from 'react';

function Drawing() {
  const board = useBoard();
  const [points, setPoints] = useState<Point[]>([]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!board) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const worldPoint = board.camera.screenToWorld({ x: screenX, y: screenY });
    setPoints([...points, worldPoint]);
  };

  return (
    <Board
      width={800}
      height={600}
      onClick={handleClick}
      animationCallback={(timestamp, ctx) => {
        // Draw all points
        ctx.fillStyle = 'red';
        points.forEach(point => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
          ctx.fill();
        });
      }}
    />
  );
}
```

### Animated Scene

```tsx
import Board, { useAnimationFrameWithBoard } from '@ue-too/board-react-adapter';
import { useState } from 'react';

function AnimatedScene() {
  const [time, setTime] = useState(0);

  useAnimationFrameWithBoard((timestamp, ctx, camera) => {
    setTime(timestamp * 0.001);

    // Draw animated circle
    const x = Math.cos(time) * 100;
    const y = Math.sin(time) * 100;

    ctx.fillStyle = 'green';
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
  });

  return null; // No UI, just updates
}

function App() {
  return (
    <Board width={800} height={600}>
      <AnimatedScene />
    </Board>
  );
}
```

### Camera Controls with Buttons

```tsx
import Board, { useCameraInput, useBoardCameraState } from '@ue-too/board-react-adapter';

function CameraControls() {
  const { panByScreen, zoomIn, zoomOut, rotateTo } = useCameraInput();
  const rotation = useBoardCameraState('rotation');

  return (
    <div style={{ position: 'absolute', top: 10, right: 10 }}>
      <button onClick={() => panByScreen({ x: 0, y: -50 })}>↑</button>
      <br />
      <button onClick={() => panByScreen({ x: -50, y: 0 })}>←</button>
      <button onClick={() => panByScreen({ x: 50, y: 0 })}>→</button>
      <br />
      <button onClick={() => panByScreen({ x: 0, y: 50 })}>↓</button>
      <br />
      <button onClick={zoomIn}>Zoom In</button>
      <button onClick={zoomOut}>Zoom Out</button>
      <br />
      <button onClick={() => rotateTo((rotation + Math.PI / 4) % (Math.PI * 2))}>
        Rotate 45°
      </button>
    </div>
  );
}

function App() {
  return (
    <Board width={800} height={600}>
      <CameraControls />
    </Board>
  );
}
```

### With Custom Animation Loop

```tsx
import { useBoardify } from '@ue-too/board-react-adapter';
import { useEffect, useRef } from 'react';

function CustomBoard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { canvas, board } = useBoardify(
    800,
    600,
    (timestamp, ctx, camera) => {
      ctx.fillStyle = 'purple';
      ctx.fillRect(-100, -100, 200, 200);
    }
  );

  useEffect(() => {
    if (canvas && containerRef.current) {
      containerRef.current.appendChild(canvas);
    }
  }, [canvas]);

  return <div ref={containerRef} />;
}
```

## API Reference

For complete API documentation with detailed type information, see the [TypeDoc-generated documentation](../../docs/board-react-adapter).

## TypeScript Support

This package is written in TypeScript with complete type definitions:

```tsx
import Board, {
  useBoardCameraState,
  useCameraInput,
  type CameraState,
  type AnimationCallback
} from '@ue-too/board-react-adapter';

// State is fully typed
const position: Point = useBoardCameraState('position');
const zoom: number = useBoardCameraState('zoomLevel');

// Functions are type-safe
const { panToWorld }: { panToWorld: (position: Point) => void } = useCameraInput();

// Callbacks are typed
const callback: AnimationCallback = (timestamp, ctx, camera) => {
  // All parameters are properly typed
};
```

## Design Philosophy

This adapter follows these principles:

- **React Idiomatic**: Uses hooks, context, and component patterns
- **Performance First**: Optimized state subscriptions with `useSyncExternalStore`
- **Type Safety**: Full TypeScript support throughout
- **Minimal API Surface**: Simple, focused hooks and components
- **Flexible**: Supports both provider and standalone patterns

## Performance Considerations

- **State Subscriptions**: Use specific state hooks (`useBoardCameraState('position')`) instead of `useAllBoardCameraState()` to minimize re-renders
- **Animation Callbacks**: Keep animation callbacks pure and avoid heavy computations
- **Canvas Updates**: Board automatically handles canvas clearing and transformation

**Performance Tips:**
- Subscribe only to the state you need
- Use `useMemo` for expensive calculations in render
- Avoid creating new objects in animation callbacks
- Use the board's built-in coordinate transformation instead of manual calculations

## Related Packages

- **[@ue-too/board](../board)**: The core infinite canvas library
- **[@ue-too/math](../math)**: Vector operations for point calculations
- **[@ue-too/animate](../animate)**: Animation system for canvas objects

## License

MIT

## Repository

[https://github.com/ue-too/ue-too](https://github.com/ue-too/ue-too)

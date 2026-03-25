# Getting Started

`@ue-too/board` is a canvas viewport management library enabling pan, zoom, rotate, and infinite canvas functionality.

## Installation

```bash
npm install @ue-too/board
```

## Basic Usage

```typescript
import { Board } from "@ue-too/board";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const board = new Board();
board.bindTo(canvas);

// Draw on the canvas
board.bindDrawFunction((ctx) => {
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, 100, 100);
});
```

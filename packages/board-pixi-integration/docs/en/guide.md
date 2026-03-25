# Getting Started

`@ue-too/board-pixi-integration` integrates the board camera system with PixiJS applications.

## Installation

```bash
npm install @ue-too/board-pixi-integration @ue-too/board pixi.js
```

## Basic Usage

```typescript
import { Board } from "@ue-too/board";
import { PixiBoardIntegration } from "@ue-too/board-pixi-integration";
import { Application } from "pixi.js";

const app = new Application();
await app.init({ width: 800, height: 600 });
const board = new Board();
const integration = new PixiBoardIntegration(board, app.stage);
```

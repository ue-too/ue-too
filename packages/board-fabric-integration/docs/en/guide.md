# Getting Started

`@ue-too/board-fabric-integration` integrates the board camera system with Fabric.js canvases.

## Installation

```bash
npm install @ue-too/board-fabric-integration @ue-too/board fabric
```

## Basic Usage

```typescript
import { Board } from "@ue-too/board";
import { FabricBoardIntegration } from "@ue-too/board-fabric-integration";
import { Canvas } from "fabric";

const fabricCanvas = new Canvas("canvas");
const board = new Board();
const integration = new FabricBoardIntegration(board, fabricCanvas);
```

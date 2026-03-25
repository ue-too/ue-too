# Getting Started

`@ue-too/board-konva-integration` integrates the board camera system with Konva.js stages.

## Installation

```bash
npm install @ue-too/board-konva-integration @ue-too/board konva
```

## Basic Usage

```typescript
import { Board } from "@ue-too/board";
import { KonvaBoardIntegration } from "@ue-too/board-konva-integration";
import Konva from "konva";

const stage = new Konva.Stage({ container: "container", width: 800, height: 600 });
const board = new Board();
const integration = new KonvaBoardIntegration(board, stage);
```

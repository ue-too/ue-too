# 入門指南

`@ue-too/board-fabric-integration` 將 board 攝影機系統與 Fabric.js 畫布整合。

## 安裝

```bash
npm install @ue-too/board-fabric-integration @ue-too/board fabric
```

## 基本用法

```typescript
import { Board } from "@ue-too/board";
import { FabricBoardIntegration } from "@ue-too/board-fabric-integration";
import { Canvas } from "fabric";

const fabricCanvas = new Canvas("canvas");
const board = new Board();
const integration = new FabricBoardIntegration(board, fabricCanvas);
```

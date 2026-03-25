# はじめに

`@ue-too/board-fabric-integration` は、board のカメラシステムを Fabric.js キャンバスと統合します。

## インストール

```bash
npm install @ue-too/board-fabric-integration @ue-too/board fabric
```

## 基本的な使い方

```typescript
import { Board } from "@ue-too/board";
import { FabricBoardIntegration } from "@ue-too/board-fabric-integration";
import { Canvas } from "fabric";

const fabricCanvas = new Canvas("canvas");
const board = new Board();
const integration = new FabricBoardIntegration(board, fabricCanvas);
```

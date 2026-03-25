# はじめに

`@ue-too/board-konva-integration` は、board のカメラシステムを Konva.js ステージと統合します。

## インストール

```bash
npm install @ue-too/board-konva-integration @ue-too/board konva
```

## 基本的な使い方

```typescript
import { Board } from "@ue-too/board";
import { KonvaBoardIntegration } from "@ue-too/board-konva-integration";
import Konva from "konva";

const stage = new Konva.Stage({ container: "container", width: 800, height: 600 });
const board = new Board();
const integration = new KonvaBoardIntegration(board, stage);
```

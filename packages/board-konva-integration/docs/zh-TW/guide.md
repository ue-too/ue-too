# 入門指南

`@ue-too/board-konva-integration` 將 board 攝影機系統與 Konva.js 舞台整合。

## 安裝

```bash
npm install @ue-too/board-konva-integration @ue-too/board konva
```

## 基本用法

```typescript
import { Board } from "@ue-too/board";
import { KonvaBoardIntegration } from "@ue-too/board-konva-integration";
import Konva from "konva";

const stage = new Konva.Stage({ container: "container", width: 800, height: 600 });
const board = new Board();
const integration = new KonvaBoardIntegration(board, stage);
```

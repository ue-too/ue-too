# 入門指南

`@ue-too/board-pixi-integration` 將 board 攝影機系統與 PixiJS 應用程式整合。

## 安裝

```bash
npm install @ue-too/board-pixi-integration @ue-too/board pixi.js
```

## 基本用法

```typescript
import { Board } from "@ue-too/board";
import { PixiBoardIntegration } from "@ue-too/board-pixi-integration";
import { Application } from "pixi.js";

const app = new Application();
await app.init({ width: 800, height: 600 });
const board = new Board();
const integration = new PixiBoardIntegration(board, app.stage);
```

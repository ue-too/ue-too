# 入門指南

`@ue-too/board` 是一個畫布視口管理庫，支援平移、縮放、旋轉和無限畫布功能。

## 安裝

```bash
npm install @ue-too/board
```

## 基本用法

```typescript
import { Board } from "@ue-too/board";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const board = new Board();
board.bindTo(canvas);

// 在畫布上繪圖
board.bindDrawFunction((ctx) => {
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, 100, 100);
});
```

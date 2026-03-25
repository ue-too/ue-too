# はじめに

`@ue-too/board` は、パン、ズーム、回転、無限キャンバス機能を備えたキャンバスビューポート管理ライブラリです。

## インストール

```bash
npm install @ue-too/board
```

## 基本的な使い方

```typescript
import { Board } from "@ue-too/board";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const board = new Board();
board.bindTo(canvas);

// キャンバスに描画
board.bindDrawFunction((ctx) => {
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, 100, 100);
});
```

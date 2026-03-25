# 入門指南

`@ue-too/board-pixi-react-integration` 提供 board 攝影機系統與 PixiJS 的 React 專用整合。

## 安裝

```bash
npm install @ue-too/board-pixi-react-integration @ue-too/board pixi.js
```

## 基本用法

```tsx
import { PixiBoardCanvas } from "@ue-too/board-pixi-react-integration";

function App() {
    return <PixiBoardCanvas width={800} height={600} />;
}
```

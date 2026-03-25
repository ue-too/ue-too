# はじめに

`@ue-too/board-pixi-react-integration` は、board のカメラシステムと PixiJS の React 専用統合を提供します。

## インストール

```bash
npm install @ue-too/board-pixi-react-integration @ue-too/board pixi.js
```

## 基本的な使い方

```tsx
import { PixiBoardCanvas } from "@ue-too/board-pixi-react-integration";

function App() {
    return <PixiBoardCanvas width={800} height={600} />;
}
```

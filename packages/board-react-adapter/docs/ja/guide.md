# はじめに

`@ue-too/board-react-adapter` は、board の無限キャンバスを React アプリケーションに統合するためのコンポーネントとフックを提供します。

## インストール

```bash
npm install @ue-too/board-react-adapter @ue-too/board
```

## 基本的な使い方

```tsx
import { BoardProvider, useBoard } from "@ue-too/board-react-adapter";

function Canvas() {
    const { bindTo } = useBoard();
    return <canvas ref={bindTo} />;
}

function App() {
    return (
        <BoardProvider>
            <Canvas />
        </BoardProvider>
    );
}
```

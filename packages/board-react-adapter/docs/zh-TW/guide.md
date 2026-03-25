# 入門指南

`@ue-too/board-react-adapter` 提供 React 元件和 hooks，將 board 無限畫布整合到 React 應用程式中。

## 安裝

```bash
npm install @ue-too/board-react-adapter @ue-too/board
```

## 基本用法

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

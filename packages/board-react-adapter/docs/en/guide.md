# Getting Started

`@ue-too/board-react-adapter` provides React components and hooks to integrate the board infinite canvas into React applications.

## Installation

```bash
npm install @ue-too/board-react-adapter @ue-too/board
```

## Basic Usage

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

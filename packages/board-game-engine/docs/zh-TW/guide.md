# 入門指南

`@ue-too/board-game-engine` 提供遊戲引擎整合，用於使用 board 攝影機系統建構棋盤類遊戲。

## 安裝

```bash
npm install @ue-too/board-game-engine @ue-too/board
```

## 基本用法

```typescript
import { GameEngine } from "@ue-too/board-game-engine";

const engine = new GameEngine();
engine.start();
```

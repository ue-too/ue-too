# はじめに

`@ue-too/board-game-engine` は、board のカメラシステムを使用してボードベースのゲームを構築するためのゲームエンジン統合を提供します。

## インストール

```bash
npm install @ue-too/board-game-engine @ue-too/board
```

## 基本的な使い方

```typescript
import { GameEngine } from "@ue-too/board-game-engine";

const engine = new GameEngine();
engine.start();
```

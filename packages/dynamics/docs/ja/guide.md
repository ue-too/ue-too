# はじめに

`@ue-too/dynamics` は、剛体力学、衝突検出、拘束、空間インデックスを備えた 2D 物理エンジンです。

## インストール

```bash
npm install @ue-too/dynamics
```

## 基本的な使い方

```typescript
import { World, RigidBody } from "@ue-too/dynamics";

const world = new World();

// 剛体を作成
const body = new RigidBody({
    position: { x: 100, y: 100 },
    mass: 1,
});

world.addBody(body);

// シミュレーションをステップ
world.step(1 / 60);
```

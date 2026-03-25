# はじめに

`@ue-too/ecs` は、スパースセットストレージとキャッシュフレンドリーなイテレーションを使用した、TypeScript 向けの高性能エンティティコンポーネントシステムアーキテクチャです。

## インストール

```bash
npm install @ue-too/ecs
```

## 基本的な使い方

```typescript
import { World, Component } from "@ue-too/ecs";

class Position extends Component {
    x = 0;
    y = 0;
}

class Velocity extends Component {
    vx = 0;
    vy = 0;
}

const world = new World();
const entity = world.createEntity();
entity.add(new Position());
entity.add(new Velocity());
```

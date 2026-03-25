# 入門指南

`@ue-too/dynamics` 是一個 2D 物理引擎，具有剛體動力學、碰撞檢測、約束和空間索引功能。

## 安裝

```bash
npm install @ue-too/dynamics
```

## 基本用法

```typescript
import { World, RigidBody } from "@ue-too/dynamics";

const world = new World();

// 建立剛體
const body = new RigidBody({
    position: { x: 100, y: 100 },
    mass: 1,
});

world.addBody(body);

// 模擬步進
world.step(1 / 60);
```

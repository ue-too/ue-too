# 入門指南

`@ue-too/ecs` 是一個高效能的 TypeScript 實體元件系統架構，使用稀疏集合儲存和快取友好的迭代。

## 安裝

```bash
npm install @ue-too/ecs
```

## 基本用法

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

# 入門指南

`@ue-too/math` 提供 2D 及 3D 點運算、向量算術、幾何變換和角度計算的數學工具。

## 安裝

```bash
npm install @ue-too/math
```

## 基本用法

```typescript
import { PointCal } from "@ue-too/math";

// 向量加法
const a = { x: 1, y: 2 };
const b = { x: 3, y: 4 };
const sum = PointCal.addVector(a, b); // { x: 4, y: 6 }

// 向量長度
const mag = PointCal.magnitude(a); // 2.236...

// 旋轉
const rotated = PointCal.rotatePoint(a, Math.PI / 2); // 90 度
```

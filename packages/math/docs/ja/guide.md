# はじめに

`@ue-too/math` は、2D・3D の点演算、ベクトル演算、幾何変換、角度計算のための数学ユーティリティを提供します。

## インストール

```bash
npm install @ue-too/math
```

## 基本的な使い方

```typescript
import { PointCal } from "@ue-too/math";

// ベクトル加算
const a = { x: 1, y: 2 };
const b = { x: 3, y: 4 };
const sum = PointCal.addVector(a, b); // { x: 4, y: 6 }

// ベクトルの大きさ
const mag = PointCal.magnitude(a); // 2.236...

// 回転
const rotated = PointCal.rotatePoint(a, Math.PI / 2); // 90度
```

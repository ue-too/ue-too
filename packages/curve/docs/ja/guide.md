# はじめに

`@ue-too/curve` は、交差検出、弧長パラメータ化、曲線演算を備えたベジェ曲線・幾何パスライブラリです。

## インストール

```bash
npm install @ue-too/curve
```

## 基本的な使い方

```typescript
import { CubicBezierCurve } from "@ue-too/curve";

const curve = new CubicBezierCurve(
    { x: 0, y: 0 },     // 始点
    { x: 50, y: 100 },   // 制御点 1
    { x: 150, y: 100 },  // 制御点 2
    { x: 200, y: 0 },    // 終点
);

// t = 0.5 の点を取得
const midPoint = curve.getPoint(0.5);

// 総弧長を取得
const length = curve.getLength();
```

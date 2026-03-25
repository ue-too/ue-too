# 入門指南

`@ue-too/curve` 是一個貝茲曲線和幾何路徑庫，具有交叉檢測、弧長參數化和曲線運算功能。

## 安裝

```bash
npm install @ue-too/curve
```

## 基本用法

```typescript
import { CubicBezierCurve } from "@ue-too/curve";

const curve = new CubicBezierCurve(
    { x: 0, y: 0 },     // 起點
    { x: 50, y: 100 },   // 控制點 1
    { x: 150, y: 100 },  // 控制點 2
    { x: 200, y: 0 },    // 終點
);

// 取得 t = 0.5 處的點
const midPoint = curve.getPoint(0.5);

// 取得總弧長
const length = curve.getLength();
```

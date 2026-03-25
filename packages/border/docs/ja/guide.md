# はじめに

`@ue-too/border` は、大圏航路、等角航路、地図投影を含む地理座標計算のための測地学・地図投影ライブラリです。

## インストール

```bash
npm install @ue-too/border
```

## 基本的な使い方

```typescript
import { GreatCircle } from "@ue-too/border";

// 2つの地理的な点の間の距離を計算
const from = { lat: 25.033, lon: 121.565 }; // 台北
const to = { lat: 35.682, lon: 139.759 };   // 東京

const distance = GreatCircle.distance(from, to);
```

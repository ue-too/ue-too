# 入門指南

`@ue-too/border` 是一個大地測量與地圖投影庫，用於地理座標計算，包括大圓導航、恆向線路徑和地圖投影。

## 安裝

```bash
npm install @ue-too/border
```

## 基本用法

```typescript
import { GreatCircle } from "@ue-too/border";

// 計算兩個地理點之間的距離
const from = { lat: 25.033, lon: 121.565 }; // 台北
const to = { lat: 35.682, lon: 139.759 };   // 東京

const distance = GreatCircle.distance(from, to);
```

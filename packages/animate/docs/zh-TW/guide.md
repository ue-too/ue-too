# 入門指南

`@ue-too/animate` 是一個基於關鍵幀的動畫庫，支援可組合動畫、緩動函數和生命週期鉤子。

## 安裝

```bash
npm install @ue-too/animate
```

## 基本用法

```typescript
import { AnimationGroup } from "@ue-too/animate";

const group = new AnimationGroup();
const animation = group.add({
    duration: 1000,
    from: { x: 0, y: 0 },
    to: { x: 100, y: 200 },
});

animation.onUpdate((value) => {
    // 動畫元素
    element.style.transform = `translate(${value.x}px, ${value.y}px)`;
});
```

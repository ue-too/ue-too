# はじめに

`@ue-too/animate` は、コンポーザブルなアニメーション、イージング関数、ライフサイクルフックを備えたキーフレームベースのアニメーションライブラリです。

## インストール

```bash
npm install @ue-too/animate
```

## 基本的な使い方

```typescript
import { AnimationGroup } from "@ue-too/animate";

const group = new AnimationGroup();
const animation = group.add({
    duration: 1000,
    from: { x: 0, y: 0 },
    to: { x: 100, y: 200 },
});

animation.onUpdate((value) => {
    // 要素をアニメーション
    element.style.transform = `translate(${value.x}px, ${value.y}px)`;
});
```

# Getting Started

`@ue-too/border` is a geodesy and map projection library for geographic coordinate calculations including great circle navigation, rhumb line paths, and map projections.

## Installation

```bash
npm install @ue-too/border
```

## Basic Usage

```typescript
import { GreatCircle } from "@ue-too/border";

// Calculate distance between two geographic points
const from = { lat: 25.033, lon: 121.565 }; // Taipei
const to = { lat: 35.682, lon: 139.759 };   // Tokyo

const distance = GreatCircle.distance(from, to);
```

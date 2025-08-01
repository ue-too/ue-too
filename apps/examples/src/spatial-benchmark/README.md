# Spatial Index Benchmark Example

This example demonstrates the performance comparison between QuadTree and Dynamic Tree spatial data structures.

## How to Run

1. **Build the dynamics package:**
   ```bash
   cd packages/dynamics
   npm run build
   ```

2. **Start the development server:**
   ```bash
   cd apps/examples
   npm run dev
   ```

3. **Open the benchmark page:**
   Navigate to `http://localhost:3000/spatial-benchmark/`

## What You'll See

The benchmark runs several test scenarios comparing QuadTree vs Dynamic Tree:

- **Dense Cluster**: Objects packed closely together
- **Sparse Distribution**: Objects spread across large area  
- **Moving Objects**: High-velocity dynamic objects
- **Line Formation**: Objects arranged in a line (worst case for QuadTree)
- **Large Scale**: Many objects testing scalability
- **Mixed Sizes**: Various object sizes

## Key Metrics

- **Insert Time**: Time to build the spatial index
- **Query Time**: Time to find nearby objects for collision detection
- **Collision Pairs**: Number of potential collision pairs found
- **Tree Statistics**: Height and node count (Dynamic Tree only)

## Expected Results

Dynamic Tree typically outperforms QuadTree for:
- Moving/dynamic objects  
- Mixed object sizes
- Scenarios without fixed world boundaries
- Consistent frame timing requirements

QuadTree works better for:
- Mostly static objects
- Uniform object sizes  
- Well-defined world boundaries
- Simple implementation needs
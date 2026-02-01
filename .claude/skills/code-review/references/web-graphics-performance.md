# Web Graphics Performance Review

Performance-critical patterns for HTML Canvas, WebGL, WebGPU, and WebAssembly applications.

## Canvas 2D Performance

### Drawing Optimization

**Batch draw calls**

```javascript
// ❌ Multiple state changes
for (const sprite of sprites) {
    ctx.fillStyle = sprite.color;
    ctx.fillRect(sprite.x, sprite.y, sprite.w, sprite.h);
}

// ✅ Group by state
const byColor = groupBy(sprites, 'color');
for (const [color, group] of Object.entries(byColor)) {
    ctx.fillStyle = color;
    for (const sprite of group) {
        ctx.fillRect(sprite.x, sprite.y, sprite.w, sprite.h);
    }
}
```

**Use offscreen canvas for complex drawings**

```javascript
// ❌ Redrawing complex shapes every frame
function render() {
    drawComplexBackground(ctx);
    drawSprites(ctx);
    requestAnimationFrame(render);
}

// ✅ Cache to offscreen canvas
const bgCanvas = document.createElement('canvas');
const bgCtx = bgCanvas.getContext('2d');
drawComplexBackground(bgCtx); // Draw once

function render() {
    ctx.drawImage(bgCanvas, 0, 0); // Fast blit
    drawSprites(ctx);
    requestAnimationFrame(render);
}
```

**Avoid unnecessary canvas clears**

```javascript
// ❌ Clearing entire canvas
ctx.clearRect(0, 0, canvas.width, canvas.height);

// ✅ Clear only dirty regions
ctx.clearRect(dirtyRect.x, dirtyRect.y, dirtyRect.w, dirtyRect.h);

// ✅ Or use opaque background (no clear needed)
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, canvas.width, canvas.height);
```

**Minimize getImageData calls**

```javascript
// ❌ Reading pixels every frame (very slow)
function render() {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    processPixels(imageData);
    ctx.putImageData(imageData, 0, 0);
}

// ✅ Use when absolutely necessary, cache when possible
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
// Process in worker or use WebGL instead
```

### Canvas State Management

**Minimize save/restore calls**

```javascript
// ❌ Excessive state changes
for (const item of items) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.angle);
    drawItem(ctx, item);
    ctx.restore();
}

// ✅ Manual transform management when possible
for (const item of items) {
    const saved = { transform: ctx.getTransform() };
    ctx.translate(item.x, item.y);
    ctx.rotate(item.angle);
    drawItem(ctx, item);
    ctx.setTransform(saved.transform);
}
```

**Avoid text measurement in render loop**

```javascript
// ❌ Measuring every frame
function render() {
    const width = ctx.measureText(text).width;
    ctx.fillText(text, x, y);
}

// ✅ Cache measurements
const textWidth = ctx.measureText(text).width;
function render() {
    ctx.fillText(text, x, y);
}
```

## WebGL Performance

### Draw Call Reduction

**Batch geometry**

```javascript
// ❌ Draw call per object
for (const mesh of meshes) {
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount);
}

// ✅ Combine into single buffer
const combinedBuffer = combineGeometry(meshes);
gl.bindBuffer(gl.ARRAY_BUFFER, combinedBuffer);
gl.drawArrays(gl.TRIANGLES, 0, totalVertexCount);
```

**Use instanced rendering**

```javascript
// ❌ Draw each instance separately
for (let i = 0; i < 1000; i++) {
    setUniform('modelMatrix', matrices[i]);
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
}

// ✅ Single draw call with instancing
const ext = gl.getExtension('ANGLE_instanced_arrays');
gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
ext.drawArraysInstancedANGLE(gl.TRIANGLES, 0, vertexCount, 1000);
```

### Texture Management

**Use texture atlases**

```javascript
// ❌ Texture bind per sprite
for (const sprite of sprites) {
    gl.bindTexture(gl.TEXTURE_2D, sprite.texture);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

// ✅ Pack into atlas, single bind
gl.bindTexture(gl.TEXTURE_2D, textureAtlas);
for (const sprite of sprites) {
    setUVs(sprite.atlasCoords);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
```

**Texture format selection**

```javascript
// ❌ Uncompressed RGBA
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

// ✅ Compressed when possible
const ext = gl.getExtension('WEBGL_compressed_texture_s3tc');
gl.compressedTexImage2D(
    gl.TEXTURE_2D,
    0,
    ext.COMPRESSED_RGBA_S3TC_DXT5_EXT,
    width,
    height,
    0,
    data
);

// ✅ Or RGB when alpha not needed
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
```

**Texture size considerations**

```javascript
// ❌ Non-power-of-two textures without mipmaps
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
// Fails for NPOT textures

// ✅ Use POT (power of two) or proper NPOT settings
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
```

### Shader Optimization

**Minimize uniform updates**

```javascript
// ❌ Setting uniforms every draw
for (const obj of objects) {
    gl.uniformMatrix4fv(modelLoc, false, obj.matrix);
    gl.uniform4fv(colorLoc, obj.color);
    gl.drawArrays(gl.TRIANGLES, 0, obj.vertexCount);
}

// ✅ Use UBOs (Uniform Buffer Objects) in WebGL2
const ubo = gl.createBuffer();
gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
gl.bufferData(gl.UNIFORM_BUFFER, matricesData, gl.DYNAMIC_DRAW);
gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo);
```

**Avoid conditionals in shaders**

```glsl
// ❌ Branching in fragment shader
void main() {
  if (useTexture) {
    gl_FragColor = texture2D(sampler, vTexCoord);
  } else {
    gl_FragColor = vColor;
  }
}

// ✅ Use separate shaders or multiply
void main() {
  vec4 texColor = texture2D(sampler, vTexCoord);
  gl_FragColor = mix(vColor, texColor, useTexture);
}
```

**Precision qualifiers**

```glsl
// ❌ Unnecessary high precision
precision highp float;
uniform highp vec3 lightPosition;

// ✅ Use appropriate precision
precision mediump float;
uniform mediump vec3 lightPosition;
// Use highp only for positions requiring precision
```

### Buffer Management

**Use appropriate buffer usage hints**

```javascript
// ❌ Wrong usage hint
gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); // But updates every frame

// ✅ Match usage pattern
gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW); // For frequent updates
gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW); // For single use
```

**Vertex data interleaving**

```javascript
// ❌ Separate buffers
const positions = new Float32Array([...]);
const texCoords = new Float32Array([...]);
const normals = new Float32Array([...]);

// ✅ Interleaved (better cache locality)
const vertices = new Float32Array([
  x, y, z, u, v, nx, ny, nz,  // vertex 1
  x, y, z, u, v, nx, ny, nz,  // vertex 2
]);
```

## WebGPU Performance

### Command Encoding

**Batch command encoding**

```javascript
// ❌ Multiple small command buffers
for (const obj of objects) {
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass(descriptor);
    pass.draw(obj.vertexCount);
    pass.end();
    device.queue.submit([encoder.finish()]);
}

// ✅ Single command buffer
const encoder = device.createCommandEncoder();
const pass = encoder.beginRenderPass(descriptor);
for (const obj of objects) {
    pass.setPipeline(obj.pipeline);
    pass.setVertexBuffer(0, obj.buffer);
    pass.draw(obj.vertexCount);
}
pass.end();
device.queue.submit([encoder.finish()]);
```

### Bind Group Optimization

**Reuse bind groups**

```javascript
// ❌ Creating bind group every frame
function render() {
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [...]
  });
  pass.setBindGroup(0, bindGroup);
}

// ✅ Create once, reuse
const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [...]
});

function render() {
  pass.setBindGroup(0, bindGroup);
}
```

**Organize by update frequency**

```javascript
// ❌ All uniforms in one bind group
// Bind Group 0: view matrix (per frame) + model matrix (per object)

// ✅ Separate by update frequency
// Bind Group 0: view matrix (per frame)
// Bind Group 1: model matrix (per object)
// Bind Group 2: material textures (per material)
```

### Buffer Usage

**Use appropriate buffer types**

```javascript
// ❌ Uniform buffer for large data
const buffer = device.createBuffer({
  size: 1024 * 1024,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
});

// ✅ Storage buffer for large data
const buffer = device.createBuffer({
  size: 1024 * 1024,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
});
```

**Map async efficiently**

```javascript
// ❌ Blocking on map
await buffer.mapAsync(GPUMapMode.WRITE);
const mapped = buffer.getMappedRange();
// ... write data
buffer.unmap();

// ✅ Use staging buffer pattern
device.queue.writeBuffer(buffer, 0, data);
```

## WebAssembly Integration

### Memory Management

**Avoid excessive boundary crossings**

```javascript
// ❌ Calling WASM for every pixel
for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        pixels[y * width + x] = wasmModule.processPixel(x, y);
    }
}

// ✅ Process in bulk
const wasmMemory = new Uint8Array(wasmModule.memory.buffer);
// Write input to WASM memory
wasmMemory.set(pixels, inputOffset);
// Single call to process all
wasmModule.processImage(width, height);
// Read output from WASM memory
pixels.set(wasmMemory.slice(outputOffset, outputOffset + pixels.length));
```

**Use typed arrays for data transfer**

```javascript
// ❌ Converting to/from JavaScript objects
const result = wasmModule.compute(points.map(p => ({ x: p.x, y: p.y })));

// ✅ Use flat typed arrays
const coords = new Float32Array(points.length * 2);
for (let i = 0; i < points.length; i++) {
    coords[i * 2] = points[i].x;
    coords[i * 2 + 1] = points[i].y;
}
wasmModule.computeFlat(coords.byteOffset, points.length);
```

### SIMD Optimization

**Use WASM SIMD when available**

```wat
;; Vector operations for 4 values at once
(func $process_simd (param $ptr i32) (param $count i32)
  (local $v v128)
  (loop $loop
    ;; Load 4 floats
    (local.set $v (v128.load (local.get $ptr)))
    ;; Process 4 values at once
    (local.set $v (f32x4.mul (local.get $v) (f32x4.splat (f32.const 2.0))))
    ;; Store result
    (v128.store (local.get $ptr) (local.get $v))
    ;; Continue
    (local.set $ptr (i32.add (local.get $ptr) (i32.const 16)))
    (br_if $loop (i32.lt_u (local.get $ptr) (local.get $count)))
  )
)
```

## General Web Graphics Best Practices

### Frame Budget Management

**Monitor frame time**

```javascript
// ✅ Track performance
let lastTime = performance.now();
function render(currentTime) {
    const deltaTime = currentTime - lastTime;

    if (deltaTime > 16.67) {
        // Dropped frame at 60fps
        console.warn(`Slow frame: ${deltaTime.toFixed(2)}ms`);
    }

    // Adaptive quality
    if (deltaTime > 20) {
        reduceQuality();
    }

    lastTime = currentTime;
    requestAnimationFrame(render);
}
```

**Use performance.now() for timing**

```javascript
// ❌ Date.now() is less precise
const start = Date.now();
complexOperation();
const duration = Date.now() - start;

// ✅ High-resolution timing
const start = performance.now();
complexOperation();
const duration = performance.now() - start;
```

### Memory Management

**Dispose resources properly**

```javascript
// ❌ WebGL resource leak
const texture = gl.createTexture();
// ... use texture
// Never deleted!

// ✅ Clean up
class Texture {
    constructor(gl) {
        this.gl = gl;
        this.texture = gl.createTexture();
    }

    dispose() {
        this.gl.deleteTexture(this.texture);
        this.texture = null;
    }
}
```

**Pool frequently created objects**

```javascript
// ❌ Creating/destroying every frame
function render() {
    const particles = [];
    for (let i = 0; i < 1000; i++) {
        particles.push(new Particle());
    }
    updateParticles(particles);
}

// ✅ Object pool
class ParticlePool {
    constructor(size) {
        this.pool = Array.from({ length: size }, () => new Particle());
        this.active = [];
    }

    spawn() {
        const particle = this.pool.pop() || new Particle();
        this.active.push(particle);
        return particle;
    }

    release(particle) {
        const idx = this.active.indexOf(particle);
        this.active.splice(idx, 1);
        particle.reset();
        this.pool.push(particle);
    }
}
```

### Asynchronous Operations

**Use workers for heavy computation**

```javascript
// ❌ Blocking main thread
function render() {
    const physics = computePhysics(objects); // Blocks rendering
    updatePositions(physics);
    draw();
}

// ✅ Offload to worker
const worker = new Worker('physics-worker.js');
worker.postMessage({ objects });
worker.onmessage = e => {
    updatePositions(e.data);
};

function render() {
    draw();
}
```

**OffscreenCanvas for background rendering**

```javascript
// ✅ Render in worker
// Main thread
const canvas = document.getElementById('canvas');
const offscreen = canvas.transferControlToOffscreen();
const worker = new Worker('renderer.js');
worker.postMessage({ canvas: offscreen }, [offscreen]);

// Worker (renderer.js)
self.onmessage = e => {
    const canvas = e.data.canvas;
    const ctx = canvas.getContext('2d');

    function render() {
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        requestAnimationFrame(render);
    }
    render();
};
```

## Performance Profiling

### What to Check

**Chrome DevTools Performance**

- Frame rate consistency (should be 60fps or 16.67ms per frame)
- GPU activity (check for excessive texture uploads)
- JavaScript execution time (should be < 8ms for 60fps)
- Rendering time (layout, paint, composite)

**WebGL/WebGPU Inspector**

- Draw call count (< 1000 for 60fps on most hardware)
- Texture memory usage
- Shader compile time
- State changes per frame

**Key Metrics**

- FPS (frames per second): Target 60fps (16.67ms budget)
- Frame time breakdown: JS (< 8ms), GPU (< 8ms), other (< 1ms)
- Draw calls: Minimize (< 500 ideal, < 2000 maximum)
- Texture switches: Batch to reduce (< 100 per frame)
- Shader switches: Minimize (< 50 per frame)
- Memory usage: Monitor for leaks and thrashing

## Common Anti-Patterns

**Avoid synchronous GPU reads**

```javascript
// ❌ Forces GPU sync (kills performance)
gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
const value = pixels[0];

// ✅ Use async reads or avoid entirely
```

**Don't recreate context repeatedly**

```javascript
// ❌ Expensive context creation
function render() {
    const ctx = canvas.getContext('2d');
    ctx.fillRect(0, 0, 100, 100);
}

// ✅ Get context once
const ctx = canvas.getContext('2d');
function render() {
    ctx.fillRect(0, 0, 100, 100);
}
```

**Avoid canvas resize in animation loop**

```javascript
// ❌ Resizing clears canvas and is expensive
function render() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
}

// ✅ Resize on window resize event only
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
```

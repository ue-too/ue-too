
/**
 * @description The transform matrix for the camera.
 * It's in the format like this:
 * ```
 * | a    c    e |
 * | b    d    f |
 * | 0    0    1 |
 * ```
 * 
 * @category Camera
 */
export type TransformationMatrix = {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
};

/**
 * Decomposes a camera transformation matrix back to camera parameters
 * 
 * Transformation order:
 * 1. Scale by device pixel ratio
 * 2. Translate to canvas center
 * 3. Rotate by -camera.rotation
 * 4. Scale by zoom level
 * 5. Translate by -camera.position
 * 
 * Final matrix: M = S1 * T1 * R * S2 * T2
 */

export function decomposeCameraMatrix(transformMatrix: TransformationMatrix, devicePixelRatio: number, canvasWidth: number, canvasHeight: number) {
    // Extract matrix elements (assuming 2D transformation matrix)
    // [a c tx]   [m00 m02 m04]
    // [b d ty] = [m01 m03 m05]
    // [0 0 1 ]   [0   0   1  ]
    
    const a = transformMatrix.a;  // m00
    const b = transformMatrix.b;  // m01  
    const c = transformMatrix.c;  // m02
    const d = transformMatrix.d;  // m03
    const tx = transformMatrix.e; // m04
    const ty = transformMatrix.f; // m05
    
    // Step 1: Extract rotation
    // The rotation is preserved in the orientation of the transformation
    const rotation = -Math.atan2(b, a); // Negative because we applied -camera.rotation
    
    // Step 2: Extract total scale and zoom
    const totalScale = Math.sqrt(a * a + b * b);
    const zoom = totalScale / devicePixelRatio;
    
    // Step 3: Extract camera position
    // We need to reverse the transformation chain:
    // Final translation = DPR * (center + R * Z * (-camera_position))
    
    // Start with the matrix translation
    let reverse = [tx, ty];
    
    // Remove DPR scaling
    reverse = [reverse[0] / devicePixelRatio, reverse[1] / devicePixelRatio];
    
    // Remove canvas center translation
    reverse = [reverse[0] - canvasWidth/2, reverse[1] - canvasHeight/2];
    
    // Apply inverse rotation (rotate by positive camera rotation)
    const cos_r = Math.cos(rotation);  // Note: positive for inverse
    const sin_r = Math.sin(rotation);
    reverse = [
        cos_r * reverse[0] - sin_r * reverse[1],
        sin_r * reverse[0] + cos_r * reverse[1]
    ];
    
    // Apply inverse zoom scaling
    reverse = [reverse[0] / zoom, reverse[1] / zoom];
    
    // Negate to get original camera position (since we applied -camera.position)
    const cameraX = -reverse[0];
    const cameraY = -reverse[1];
    
    return {
        position: { x: cameraX, y: cameraY },
        zoom: zoom,
        rotation: rotation
    };
}

// Alternative implementation using matrix operations for clarity
function decomposeCameraMatrixVerbose(transformMatrix: TransformationMatrix, devicePixelRatio: number, canvasWidth: number, canvasHeight: number) {
    const a = transformMatrix.a;
    const b = transformMatrix.b;
    const c = transformMatrix.c;
    const d = transformMatrix.d;
    const tx = transformMatrix.e;
    const ty = transformMatrix.f;
    
    console.log('Input matrix:');
    console.log(`[${a.toFixed(3)}, ${c.toFixed(3)}, ${tx.toFixed(3)}]`);
    console.log(`[${b.toFixed(3)}, ${d.toFixed(3)}, ${ty.toFixed(3)}]`);
    console.log('[0.000, 0.000, 1.000]');
    
    // Extract rotation
    const rotation = -Math.atan2(b, a);
    console.log(`\nExtracted rotation: ${(rotation * 180 / Math.PI).toFixed(2)}°`);
    
    // Extract zoom
    const totalScale = Math.sqrt(a * a + b * b);
    const zoom = totalScale / devicePixelRatio;
    console.log(`Extracted zoom: ${zoom.toFixed(3)}`);
    
    // Extract camera position
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    // First remove DPR scaling from the final translation
    const unscaledTx = tx / devicePixelRatio;
    const unscaledTy = ty / devicePixelRatio;
    console.log(`After removing DPR: [${unscaledTx.toFixed(3)}, ${unscaledTy.toFixed(3)}]`);
    
    // Then remove canvas center offset
    const adjustedTx = unscaledTx - centerX;
    const adjustedTy = unscaledTy - centerY;
    console.log(`After removing canvas center: [${adjustedTx.toFixed(3)}, ${adjustedTy.toFixed(3)}]`);
    
    // Reverse rotation
    const cos_r = Math.cos(-rotation);
    const sin_r = Math.sin(-rotation);
    const rotatedBackX = cos_r * adjustedTx + sin_r * adjustedTy;
    const rotatedBackY = -sin_r * adjustedTx + cos_r * adjustedTy;
    console.log(`After inverse rotation: [${rotatedBackX.toFixed(3)}, ${rotatedBackY.toFixed(3)}]`);
    
    // Reverse zoom scaling and negate (because we applied -camera.position)
    const cameraX = -rotatedBackX / zoom;
    const cameraY = -rotatedBackY / zoom;
    console.log(`Final camera position: [${cameraX.toFixed(3)}, ${cameraY.toFixed(3)}]`);
    
    return {
        position: { x: cameraX, y: cameraY },
        zoom: zoom,
        rotation: rotation
    };
}

// Helper function to create the transformation matrix from camera parameters
export function createCameraMatrix(cameraPos: {x: number, y: number}, zoom: number, rotation: number, devicePixelRatio: number, canvasWidth: number, canvasHeight: number) {
    // Step 1: Scale by device pixel ratio
    let matrix: TransformationMatrix = {
        a: devicePixelRatio,
        b: 0,
        c: 0,
        d: devicePixelRatio,
        e: 0,
        f: 0
    };
    
    // Step 2: Translate to canvas center
    const multipliedMatrix = multiplyMatrix(matrix, {
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        e: canvasWidth/2,
        f: canvasHeight/2
    });
    
    // Step 3: Rotate (negative camera rotation)
    const cos_r = Math.cos(-rotation);
    const sin_r = Math.sin(-rotation);
    const rotatedMatrix = multiplyMatrix(multipliedMatrix, {
        a: cos_r,
        b: sin_r,
        c: -sin_r,
        d: cos_r,
        e: 0,
        f: 0
    });
    
    // Step 4: Scale by zoom
    const zoomedMatrix = multiplyMatrix(rotatedMatrix, {
        a: zoom,
        b: 0,
        c: 0,
        d: zoom,
        e: 0,
        f: 0
    });
    
    // Step 5: Translate by negative camera position
    const translatedMatrix = multiplyMatrix(zoomedMatrix, {
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        e: -cameraPos.x,
        f: -cameraPos.y
    });
    return translatedMatrix;
}

// Matrix multiplication helper (2D transformation matrices)
export function multiplyMatrix(m1: TransformationMatrix, m2: TransformationMatrix) {
    const a1 = m1.a;
    const b1 = m1.b;
    const c1 = m1.c;
    const d1 = m1.d;
    const tx1 = m1.e;
    const ty1 = m1.f;

    const a2 = m2.a;
    const b2 = m2.b;
    const c2 = m2.c;
    const d2 = m2.d;
    const tx2 = m2.e;
    const ty2 = m2.f;
    
    return {
        a: a1 * a2 + c1 * b2,      // a
        b: b1 * a2 + d1 * b2,      // b
        c: a1 * c2 + c1 * d2,      // c
        d: b1 * c2 + d1 * d2,      // d
        e: a1 * tx2 + c1 * ty2 + tx1,  // tx
        f: b1 * tx2 + d1 * ty2 + ty1   // ty
    };
}

// Example usage and test
function testDecomposition() {
    // Test parameters
    const originalCamera = {
        position: { x: 100, y: 50 },
        zoom: 2.0,
        rotation: Math.PI / 6 // 30 degrees
    };
    const devicePixelRatio = 1.5;
    const canvasWidth = 800;
    const canvasHeight = 600;
    
    console.log('=== Testing Camera Matrix Decomposition ===');
    console.log('Original camera parameters:');
    console.log(`Position: (${originalCamera.position.x}, ${originalCamera.position.y})`);
    console.log(`Zoom: ${originalCamera.zoom}`);
    console.log(`Rotation: ${(originalCamera.rotation * 180 / Math.PI).toFixed(2)}°`);
    console.log(`Device Pixel Ratio: ${devicePixelRatio}`);
    console.log(`Canvas: ${canvasWidth}x${canvasHeight}`);
    
    // Create transformation matrix
    const matrix = createCameraMatrix(
        originalCamera.position, 
        originalCamera.zoom, 
        originalCamera.rotation, 
        devicePixelRatio, 
        canvasWidth, 
        canvasHeight
    );
    
    console.log('\n=== Decomposition Process ===');
    
    // Decompose the matrix
    const decomposed = decomposeCameraMatrixVerbose(
        matrix, 
        devicePixelRatio, 
        canvasWidth, 
        canvasHeight
    );
    
    console.log('\n=== Results ===');
    console.log('Decomposed camera parameters:');
    console.log(`Position: (${decomposed.position.x.toFixed(3)}, ${decomposed.position.y.toFixed(3)})`);
    console.log(`Zoom: ${decomposed.zoom.toFixed(3)}`);
    console.log(`Rotation: ${(decomposed.rotation * 180 / Math.PI).toFixed(2)}°`);
    
    // Check accuracy
    const posError = Math.sqrt(
        Math.pow(originalCamera.position.x - decomposed.position.x, 2) + 
        Math.pow(originalCamera.position.y - decomposed.position.y, 2)
    );
    const zoomError = Math.abs(originalCamera.zoom - decomposed.zoom);
    const rotError = Math.abs(originalCamera.rotation - decomposed.rotation);
    
    console.log('\n=== Accuracy Check ===');
    console.log(`Position error: ${posError.toFixed(6)}`);
    console.log(`Zoom error: ${zoomError.toFixed(6)}`);
    console.log(`Rotation error: ${rotError.toFixed(6)} radians`);
}

// Run the test
// testDecomposition();

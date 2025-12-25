/**
 * 2D affine transformation matrix in standard CSS/Canvas format.
 *
 * Represents a 3x3 matrix in homogeneous coordinates, stored in the compact 6-parameter form:
 * ```
 * | a  c  e |
 * | b  d  f |
 * | 0  0  1 |
 * ```
 *
 * @property a - Horizontal scaling / rotation component (m11)
 * @property b - Vertical skewing / rotation component (m12)
 * @property c - Horizontal skewing / rotation component (m21)
 * @property d - Vertical scaling / rotation component (m22)
 * @property e - Horizontal translation (tx)
 * @property f - Vertical translation (ty)
 *
 * @remarks
 * This format is compatible with:
 * - Canvas 2D context: `ctx.setTransform(a, b, c, d, e, f)`
 * - CSS transforms: `matrix(a, b, c, d, e, f)`
 * - SVG transforms: `matrix(a b c d e f)`
 *
 * Common transformation types:
 * - **Translation**: `{a: 1, b: 0, c: 0, d: 1, e: tx, f: ty}`
 * - **Scaling**: `{a: sx, b: 0, c: 0, d: sy, e: 0, f: 0}`
 * - **Rotation**: `{a: cos(θ), b: sin(θ), c: -sin(θ), d: cos(θ), e: 0, f: 0}`
 *
 * @example
 * ```typescript
 * // Identity matrix (no transformation)
 * const identity: TransformationMatrix = {
 *   a: 1, b: 0, c: 0, d: 1, e: 0, f: 0
 * };
 *
 * // Translation by (100, 50)
 * const translate: TransformationMatrix = {
 *   a: 1, b: 0, c: 0, d: 1, e: 100, f: 50
 * };
 *
 * // 2x scale
 * const scale: TransformationMatrix = {
 *   a: 2, b: 0, c: 0, d: 2, e: 0, f: 0
 * };
 *
 * // 45° rotation
 * const rotate: TransformationMatrix = {
 *   a: 0.707, b: 0.707, c: -0.707, d: 0.707, e: 0, f: 0
 * };
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
 * Decomposes a camera transformation matrix back to camera parameters.
 * Inverse operation of {@link createCameraMatrix}.
 *
 * @param transformMatrix - The combined transformation matrix to decompose
 * @param devicePixelRatio - Device pixel ratio used when creating the matrix
 * @param canvasWidth - Canvas width in CSS pixels
 * @param canvasHeight - Canvas height in CSS pixels
 * @returns Camera parameters: position, zoom, and rotation
 *
 * @remarks
 * This function reverses the transformation chain applied by {@link createCameraMatrix}:
 * 1. Scale by devicePixelRatio
 * 2. Translate to canvas center
 * 3. Rotate by -camera.rotation
 * 4. Scale by zoom level
 * 5. Translate by -camera.position
 *
 * Final matrix: M = Scale(DPR) * Translate(center) * Rotate * Scale(zoom) * Translate(-position)
 *
 * The decomposition extracts:
 * - **Rotation**: From the orientation of the transformation (atan2)
 * - **Zoom**: From the total scale after removing devicePixelRatio
 * - **Position**: By reversing the translation chain
 *
 * @example
 * ```typescript
 * // Create and then decompose a matrix
 * const matrix = createCameraMatrix(
 *   { x: 100, y: 200 },
 *   2.0,
 *   Math.PI / 4,
 *   window.devicePixelRatio,
 *   1920, 1080
 * );
 *
 * const params = decomposeCameraMatrix(
 *   matrix,
 *   window.devicePixelRatio,
 *   1920, 1080
 * );
 * // params ≈ { position: {x: 100, y: 200}, zoom: 2.0, rotation: π/4 }
 * ```
 *
 * @category Camera
 * @see {@link createCameraMatrix} for the inverse operation
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

/**
 * Creates a camera transformation matrix from camera parameters.
 * This matrix transforms world coordinates to canvas pixel coordinates.
 *
 * @param cameraPos - Camera position in world coordinates
 * @param zoom - Zoom level (1.0 = 100%, 2.0 = 200%, etc.)
 * @param rotation - Camera rotation in radians
 * @param devicePixelRatio - Device pixel ratio (typically window.devicePixelRatio)
 * @param canvasWidth - Canvas width in CSS pixels (not canvas.width!)
 * @param canvasHeight - Canvas height in CSS pixels (not canvas.height!)
 * @returns Transformation matrix for world→canvas conversion
 *
 * @remarks
 * **Important**: canvasWidth and canvasHeight are CSS pixel dimensions,
 * not the internal canvas buffer size (canvas.width/canvas.height).
 * Use element.clientWidth/clientHeight or the CSS dimensions.
 *
 * Transformation order:
 * 1. Scale by devicePixelRatio (for high-DPI displays)
 * 2. Translate to canvas center
 * 3. Rotate by -camera.rotation (negated for correct direction)
 * 4. Scale by zoom
 * 5. Translate by -camera.position (world offset)
 *
 * The resulting matrix can be applied to a canvas context:
 * ```typescript
 * const {a, b, c, d, e, f} = createCameraMatrix(...);
 * ctx.setTransform(a, b, c, d, e, f);
 * // Now draw at world coordinates
 * ```
 *
 * @example
 * ```typescript
 * const matrix = createCameraMatrix(
 *   { x: 100, y: 200 },          // camera position
 *   2.0,                          // 2x zoom
 *   Math.PI / 6,                  // 30° rotation
 *   window.devicePixelRatio,
 *   canvas.clientWidth,           // CSS width, not canvas.width!
 *   canvas.clientHeight
 * );
 *
 * ctx.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
 * ctx.fillRect(100, 200, 50, 50);  // Draws at world coordinates (100, 200)
 * ```
 *
 * @category Camera
 * @see {@link decomposeCameraMatrix} for extracting camera parameters from a matrix
 */
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

/**
 * Multiplies two 2D transformation matrices.
 * Order matters: M = m1 × m2 applies m2 first, then m1.
 *
 * @param m1 - First transformation matrix (applied second)
 * @param m2 - Second transformation matrix (applied first)
 * @returns Combined transformation matrix
 *
 * @remarks
 * Matrix multiplication is not commutative: m1 × m2 ≠ m2 × m1
 *
 * The result applies transformations in right-to-left order:
 * - Result = m1 × m2
 * - Applying result to point P: (m1 × m2) × P = m1 × (m2 × P)
 * - m2 is applied first, then m1
 *
 * Common use: Building composite transformations
 * ```typescript
 * // Translate then rotate (rotate happens first!)
 * const translate = { a: 1, b: 0, c: 0, d: 1, e: 100, f: 0 };
 * const rotate = { a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 }; // 90° ccw
 * const combined = multiplyMatrix(translate, rotate);
 * // Points are rotated, then translated
 * ```
 *
 * @example
 * ```typescript
 * // Combine scale and translation
 * const scale2x: TransformationMatrix = {
 *   a: 2, b: 0, c: 0, d: 2, e: 0, f: 0
 * };
 * const translate: TransformationMatrix = {
 *   a: 1, b: 0, c: 0, d: 1, e: 100, f: 50
 * };
 *
 * // Scale then translate
 * const combined = multiplyMatrix(translate, scale2x);
 * // Points are scaled by 2, then translated by (100, 50)
 *
 * // Chain multiple transformations
 * const m = multiplyMatrix(
 *   multiplyMatrix(translate, rotate),
 *   scale
 * );
 * // Equivalent to: scale → rotate → translate
 * ```
 *
 * @category Matrix
 */
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

/**
 * Decomposes a 2D transformation matrix into Translation, Rotation, and Scale (TRS)
 * 
 * @param matrix - The transformation matrix to decompose
 * @returns Object containing translation, rotation (in radians), and scale components
 * 
 * @category Matrix
 */
export function decomposeTRS(matrix: TransformationMatrix): {
    translation: { x: number; y: number };
    rotation: number;
    scale: { x: number; y: number };
} {
    const { a, b, c, d, e, f } = matrix;
    
    // Translation is directly available in the matrix
    const translation = { x: e, y: f };
    
    // Extract rotation and scale using QR decomposition
    // For 2D matrices, we can use a simpler approach
    
    // Calculate the determinant to check if the matrix is valid
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-10) {
        // Matrix is singular or nearly singular
        throw new Error('Matrix is singular and cannot be decomposed');
    }
    
    // Extract rotation using atan2
    // The rotation is the angle of the first column vector (a, b)
    const rotation = Math.atan2(b, a);
    
    // Extract scale by normalizing the rotation component
    const cos_r = Math.cos(rotation);
    const sin_r = Math.sin(rotation);
    
    // Remove rotation from the matrix to get pure scaling
    // R^(-1) * M = S
    const scaleX = a * cos_r + b * sin_r;
    const scaleY = c * (-sin_r) + d * cos_r;
    
    // Handle negative scales by adjusting rotation
    let finalRotation = rotation;
    let finalScaleX = scaleX;
    let finalScaleY = scaleY;
    
    if (scaleX < 0) {
        finalScaleX = -scaleX;
        finalRotation += Math.PI;
    }
    if (scaleY < 0) {
        finalScaleY = -scaleY;
        finalRotation += Math.PI;
    }
    
    // Normalize rotation to [-π, π]
    while (finalRotation > Math.PI) finalRotation -= 2 * Math.PI;
    while (finalRotation < -Math.PI) finalRotation += 2 * Math.PI;
    
    return {
        translation,
        rotation: finalRotation,
        scale: { x: finalScaleX, y: finalScaleY }
    };
}

/**
 * Creates a transformation matrix from Translation, Rotation, and Scale components.
 * Inverse of {@link decomposeTRS}.
 *
 * @param translation - Translation vector (tx, ty)
 * @param rotation - Rotation angle in radians (counter-clockwise)
 * @param scale - Scale vector (sx, sy)
 * @returns Transformation matrix combining TRS
 *
 * @remarks
 * Transformation order: Scale → Rotate → Translate
 *
 * The resulting matrix is in standard form compatible with Canvas/CSS/SVG.
 * Applying this matrix transforms points as:
 * 1. Scale by (sx, sy)
 * 2. Rotate by θ radians
 * 3. Translate by (tx, ty)
 *
 * @example
 * ```typescript
 * // Create a transform that scales 2x, rotates 45°, then moves to (100, 50)
 * const matrix = createTRSMatrix(
 *   { x: 100, y: 50 },            // translation
 *   Math.PI / 4,                   // 45° rotation
 *   { x: 2, y: 2 }                 // 2x scale
 * );
 *
 * ctx.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
 * // Now drawing happens with scale→rotate→translate applied
 *
 * // Round-trip test
 * const decomposed = decomposeTRS(matrix);
 * // decomposed ≈ { translation: {x:100, y:50}, rotation: π/4, scale: {x:2, y:2} }
 * ```
 *
 * @category Matrix
 * @see {@link decomposeTRS} for extracting TRS from a matrix
 */
export function createTRSMatrix(
    translation: { x: number; y: number },
    rotation: number,
    scale: { x: number; y: number }
): TransformationMatrix {
    const cos_r = Math.cos(rotation);
    const sin_r = Math.sin(rotation);
    
    return {
        a: scale.x * cos_r,
        b: scale.x * sin_r,
        c: -scale.y * sin_r,
        d: scale.y * cos_r,
        e: translation.x,
        f: translation.y
    };
}

/**
 * Decomposes a matrix using SVD (Singular Value Decomposition) approach
 * This is an alternative method that can handle more complex transformations
 * 
 * @param matrix - The transformation matrix to decompose
 * @returns Object containing translation, rotation, and scale components
 * 
 * @category Matrix
 */
export function decomposeTRSSVD(matrix: TransformationMatrix): {
    translation: { x: number; y: number };
    rotation: number;
    scale: { x: number; y: number };
} {
    const { a, b, c, d, e, f } = matrix;
    
    // Translation is directly available
    const translation = { x: e, y: f };
    
    // Extract the 2x2 transformation part
    const m11 = a, m12 = c;
    const m21 = b, m22 = d;
    
    // Compute SVD: M = U * S * V^T
    // For 2x2 matrices, we can compute this analytically
    
    // Compute M^T * M = V * S^2 * V^T
    const mtm11 = m11 * m11 + m21 * m21;
    const mtm12 = m11 * m12 + m21 * m22;
    const mtm21 = mtm12;
    const mtm22 = m12 * m12 + m22 * m22;
    
    // Compute eigenvalues of M^T * M
    const trace = mtm11 + mtm22;
    const det = mtm11 * mtm22 - mtm12 * mtm21;
    const discriminant = trace * trace - 4 * det;
    
    if (discriminant < 0) {
        throw new Error('Invalid transformation matrix');
    }
    
    const sqrtDisc = Math.sqrt(discriminant);
    const lambda1 = (trace + sqrtDisc) / 2;
    const lambda2 = (trace - sqrtDisc) / 2;
    
    // Singular values are square roots of eigenvalues
    const s1 = Math.sqrt(Math.max(0, lambda1));
    const s2 = Math.sqrt(Math.max(0, lambda2));
    
    // Scale is the singular values
    const scale = { x: s1, y: s2 };
    
    // Compute rotation from U matrix
    // U = M * V * S^(-1)
    let rotation = 0;
    
    if (s1 > 1e-10) {
        // Compute V matrix (eigenvectors of M^T * M)
        const v11 = mtm12;
        const v12 = lambda1 - mtm11;
        const v21 = lambda2 - mtm22;
        const v22 = mtm21;
        
        // Normalize V
        const vNorm1 = Math.sqrt(v11 * v11 + v21 * v21);
        const vNorm2 = Math.sqrt(v12 * v12 + v22 * v22);
        
        if (vNorm1 > 1e-10 && vNorm2 > 1e-10) {
            const v11n = v11 / vNorm1;
            const v21n = v21 / vNorm1;
            const v12n = v12 / vNorm2;
            const v22n = v22 / vNorm2;
            
            // Compute U = M * V * S^(-1)
            const u11 = (m11 * v11n + m12 * v21n) / s1;
            const u21 = (m21 * v11n + m22 * v21n) / s1;
            
            rotation = Math.atan2(u21, u11);
        }
    }
    
    return {
        translation,
        rotation,
        scale
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

/**
 * Test function for TRS decomposition
 */
function testTRSDecomposition() {
    console.log('=== Testing TRS Decomposition ===');
    
    // Test case 1: Simple translation
    console.log('\n--- Test 1: Simple Translation ---');
    const translation = { x: 10, y: 20 };
    const rotation = 0;
    const scale = { x: 1, y: 1 };
    
    const matrix1 = createTRSMatrix(translation, rotation, scale);
    const decomposed1 = decomposeTRS(matrix1);
    
    console.log('Original:', { translation, rotation, scale });
    console.log('Decomposed:', decomposed1);
    
    // Test case 2: Translation + Rotation
    console.log('\n--- Test 2: Translation + Rotation ---');
    const translation2 = { x: 15, y: 25 };
    const rotation2 = Math.PI / 4; // 45 degrees
    const scale2 = { x: 1, y: 1 };
    
    const matrix2 = createTRSMatrix(translation2, rotation2, scale2);
    const decomposed2 = decomposeTRS(matrix2);
    
    console.log('Original:', { translation: translation2, rotation: rotation2, scale: scale2 });
    console.log('Decomposed:', decomposed2);
    
    // Test case 3: Translation + Rotation + Scale
    console.log('\n--- Test 3: Translation + Rotation + Scale ---');
    const translation3 = { x: 30, y: 40 };
    const rotation3 = Math.PI / 3; // 60 degrees
    const scale3 = { x: 2, y: 1.5 };
    
    const matrix3 = createTRSMatrix(translation3, rotation3, scale3);
    const decomposed3 = decomposeTRS(matrix3);
    
    console.log('Original:', { translation: translation3, rotation: rotation3, scale: scale3 });
    console.log('Decomposed:', decomposed3);
    
    // Test case 4: Negative scale
    console.log('\n--- Test 4: Negative Scale ---');
    const translation4 = { x: 50, y: 60 };
    const rotation4 = Math.PI / 6; // 30 degrees
    const scale4 = { x: -1.5, y: 2 };
    
    const matrix4 = createTRSMatrix(translation4, rotation4, scale4);
    const decomposed4 = decomposeTRS(matrix4);
    
    console.log('Original:', { translation: translation4, rotation: rotation4, scale: scale4 });
    console.log('Decomposed:', decomposed4);
    
    // Test case 5: Compare with SVD method
    console.log('\n--- Test 5: Compare TRS vs SVD ---');
    const decomposed5TRS = decomposeTRS(matrix3);
    const decomposed5SVD = decomposeTRSSVD(matrix3);
    
    console.log('TRS method:', decomposed5TRS);
    console.log('SVD method:', decomposed5SVD);
    
    // Test reconstruction
    console.log('\n--- Test 6: Matrix Reconstruction ---');
    const reconstructed = createTRSMatrix(
        decomposed3.translation,
        decomposed3.rotation,
        decomposed3.scale
    );
    
    console.log('Original matrix:', matrix3);
    console.log('Reconstructed matrix:', reconstructed);
    
    const matrixError = Math.sqrt(
        Math.pow(matrix3.a - reconstructed.a, 2) +
        Math.pow(matrix3.b - reconstructed.b, 2) +
        Math.pow(matrix3.c - reconstructed.c, 2) +
        Math.pow(matrix3.d - reconstructed.d, 2) +
        Math.pow(matrix3.e - reconstructed.e, 2) +
        Math.pow(matrix3.f - reconstructed.f, 2)
    );
    
    console.log(`Matrix reconstruction error: ${matrixError.toFixed(10)}`);
}

// Run the test
// testDecomposition();
// testTRSDecomposition();

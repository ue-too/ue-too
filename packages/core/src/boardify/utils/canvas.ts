/**
 * This is for proxying the canvas context methods that need to flip the y-coordinates.
 * @internal
 */
const methodsToFlip: Record<string, number[]> = {
    fillRect: [1],        // [yIndex] - indices of y-coordinates to flip
    strokeRect: [1],
    fillText: [2],
    strokeText: [1],
    lineTo: [1],
    moveTo: [1],
    quadraticCurveTo: [1, 3],
    bezierCurveTo: [1, 3, 5],
    arc: [1],
    drawImage: [2],        // Base case for first two signatures
    rect: [1],
    roundRect: [1],
};

export function reverseYAxis(context: CanvasRenderingContext2D): CanvasRenderingContext2D {
    return new Proxy(context, {
        get(target: CanvasRenderingContext2D, prop: string | symbol, receiver: any): any {
            const value = Reflect.get(target, prop, target);
            
            // Check if this is a method that needs y-coordinate flipping
            if (typeof prop === 'string' && prop in methodsToFlip && typeof value === 'function') {
                return function(...args: any[]) {
                    // Create a copy of the arguments
                    const newArgs = [...args];
                    
                    // Special handling for drawImage with 9 arguments (third signature of drawImage)
                    if (prop === 'drawImage' && args.length === 9) {
                        const convertedArgs = invertYAxisForDrawImageWith9Args(args);
                        return value.apply(target, convertedArgs);
                    } else {
                        // Flip the y-coordinates based on methodsToFlip configuration
                        const yIndices = methodsToFlip[prop];
                        for (const index of yIndices) {
                            if (index < newArgs.length) {
                                newArgs[index] = -newArgs[index];
                            }
                        }
                        // Special handling for drawImage with 5 arguments (first signature of drawImage)
                        if(prop === "drawImage" && args.length === 5){
                            newArgs[2] -= newArgs[4];
                        }
                    }
                    
                    // Call the original method with the modified arguments
                    return value.apply(target, newArgs);
                };
            }
            
            // Return the original value for properties and methods that don't need modification
            if (typeof value === 'function') {
                return function(...args: any[]) {
                    return value.apply(target, args);
                };
            }
            
            return value;
        },
        set(target, prop, value): boolean {
            return Reflect.set(target, prop, value);
        }
    });
}

export function invertYAxisForDrawImageWith9Args(args: any[]): typeof args {
    if(args.length !== 9){
        return args;
    }
    const newArgs = [...args];
    const imageHeight = args[0].height;
    if(imageHeight !== undefined){
        newArgs[2] = imageHeight - newArgs[2];
        newArgs[6] = -newArgs[6];
        newArgs[6] -= newArgs[8];
        newArgs[4] = -newArgs[4];
    }
    return newArgs;
}

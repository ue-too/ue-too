/**
 * This is for proxying the canvas context methods that need to flip the y-coordinates.
 * @internal
 */
const methodsToFlip: Record<string, number[]> = {
    fillRect: [1],        // [yIndex] - indices of y-coordinates to flip
    strokeRect: [1],
    fillText: [1],
    strokeText: [1],
    lineTo: [1],
    moveTo: [1],
    quadraticCurveTo: [1, 3],
    bezierCurveTo: [1, 3, 5],
    arc: [1],
    drawImage: [2]        // Base case for first two signatures
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
                    
                    // Special handling for drawImage with 9 arguments (third signature)
                    if (prop === 'drawImage' && args.length === 9) {
                        newArgs[6] = -newArgs[6]; // Flip only dy
                    } else {
                        // Flip the y-coordinates based on methodsToFlip configuration
                        const yIndices = methodsToFlip[prop];
                        for (const index of yIndices) {
                            if (index < newArgs.length) {
                                newArgs[index] = -newArgs[index];
                            }
                        }
                        if(prop === "drawImage" && args.length === 3){
                            console.log("drawImage with only 3 args and the delta height is", args[2]);
                            // newArgs[index] += 
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

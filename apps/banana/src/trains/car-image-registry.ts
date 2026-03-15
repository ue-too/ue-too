/**
 * Maps car IDs to image data URLs for custom car textures.
 * When a car is created from a template that has an image,
 * register the car ID here so the render system can use it.
 */
export class CarImageRegistry {
    private _images: Map<string, string> = new Map();

    set(carId: string, imageSrc: string): void {
        this._images.set(carId, imageSrc);
    }

    get(carId: string): string | undefined {
        return this._images.get(carId);
    }

    has(carId: string): boolean {
        return this._images.has(carId);
    }

    delete(carId: string): void {
        this._images.delete(carId);
    }

    clear(): void {
        this._images.clear();
    }
}

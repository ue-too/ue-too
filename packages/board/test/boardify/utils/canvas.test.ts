import { invertYAxisForDrawImageWith9Args } from '../../../src/utils';

// Mock Image class for testing
class MockImage {
    width: number;
    height: number;
    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
    }
}

describe('canvas', () => {
    it('should invert the y-axis for drawImage with 9 arguments', () => {
        const image = new MockImage(1200, 1500);
        const args = [image, 0, 0, 300, 300, 200, 200, 300, 300];
        const newArgs = invertYAxisForDrawImageWith9Args(args);
        expect(newArgs).toEqual([
            image,
            0,
            1500,
            300,
            -300,
            200,
            -500,
            300,
            300,
        ]);
    });
});

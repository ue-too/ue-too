// Mock browser APIs for Node.js test environment

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation((callback) => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
    _callback: callback, // Store callback for testing
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation((callback) => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
    _callback: callback, // Store callback for testing
}));

// Mock DOMRect
global.DOMRect = jest.fn().mockImplementation((x = 0, y = 0, width = 0, height = 0) => ({
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    bottom: y + height,
    right: x + width,
    toJSON: jest.fn(),
}));

// Mock HTMLCanvasElement
global.HTMLCanvasElement = jest.fn().mockImplementation(() => ({
    getBoundingClientRect: jest.fn().mockReturnValue(new DOMRect(0, 0, 100, 100)),
}));

// Mock window.getComputedStyle
Object.defineProperty(global, 'window', {
    value: {
        getComputedStyle: jest.fn().mockReturnValue({
            paddingLeft: '0px',
            paddingTop: '0px',
            paddingRight: '0px',
            paddingBottom: '0px',
            borderLeftWidth: '0px',
            borderTopWidth: '0px',
            borderRightWidth: '0px',
            borderBottomWidth: '0px',
        }),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    },
    writable: true,
});

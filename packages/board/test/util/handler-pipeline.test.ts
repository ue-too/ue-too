import { createHandlerChain } from '../../src/utils/handler-pipeline';

describe('handler-pipeline', () => {
    it('should create a handler chain from an array of handlers', () => {
        const handler1 = jest.fn().mockReturnValue(2);
        const handler2 = jest.fn().mockReturnValue(3);
        const handler3 = jest.fn().mockReturnValue(4);
        const handlerChain = createHandlerChain(handler1, handler2, handler3);
        const result = handlerChain(1);
        expect(handler1).toHaveBeenCalledWith(1);
        expect(handler2).toHaveBeenCalledWith(2);
        expect(handler3).toHaveBeenCalledWith(3);
        expect(result).toBe(4);
    });

    it('should pass additional arguments to each handler', () => {
        const handler1 = jest.fn().mockReturnValue(2);
        const handler2 = jest.fn().mockReturnValue(3);
        const handler3 = jest.fn().mockReturnValue(4);
        const handlerChain = createHandlerChain(handler1, handler2, handler3);
        const result = handlerChain(1, 'arg1', 'arg2');
        expect(handler1).toHaveBeenCalledWith(1, 'arg1', 'arg2');
        expect(handler2).toHaveBeenCalledWith(2, 'arg1', 'arg2');
        expect(handler3).toHaveBeenCalledWith(3, 'arg1', 'arg2');
        expect(result).toBe(4);
    });

    it('should work with a single handler', () => {
        const handler = jest.fn().mockReturnValue(2);
        const handlerChain = createHandlerChain(handler);
        const result = handlerChain(1);
        expect(handler).toHaveBeenCalledWith(1);
        expect(result).toBe(2);
    });

    it('should work with an array of handlers', () => {
        const handler1 = jest.fn().mockReturnValue(2);
        const handler2 = jest.fn().mockReturnValue(3);
        const handler3 = jest.fn().mockReturnValue(4);
        const handlers = [handler1, handler2, handler3];
        const handlerChain = createHandlerChain(handlers);
        const result = handlerChain(1);
        expect(handler1).toHaveBeenCalledWith(1);
        expect(handler2).toHaveBeenCalledWith(2);
        expect(handler3).toHaveBeenCalledWith(3);
        expect(result).toBe(4);
    });

    it('should return the initial value if no handlers are provided', () => {
        const handlerChain = createHandlerChain();
        const result = handlerChain(1);
        expect(result).toBe(1);
    });

    it('should handle handlers that return undefined', () => {
        const handler1 = jest.fn().mockReturnValue(undefined);
        const handler2 = jest.fn().mockReturnValue(3);
        const handlerChain = createHandlerChain(handler1, handler2);
        const result = handlerChain(1);
        expect(handler1).toHaveBeenCalledWith(1);
        expect(handler2).toHaveBeenCalledWith(undefined);
        expect(result).toBe(3);
    });

    it('should handle handlers that return null', () => {
        const handler1 = jest.fn().mockReturnValue(null);
        const handler2 = jest.fn().mockReturnValue(3);
        const handlerChain = createHandlerChain(handler1, handler2);
        const result = handlerChain(1);
        expect(handler1).toHaveBeenCalledWith(1);
        expect(handler2).toHaveBeenCalledWith(null);
        expect(result).toBe(3);
    });
});

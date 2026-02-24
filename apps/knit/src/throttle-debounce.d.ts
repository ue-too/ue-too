declare module 'throttle-debounce' {
    /**
     * Throttle: invoke at most once per `delay` ms.
     */
    export function throttle<T extends (...args: unknown[]) => unknown>(
        delay: number,
        callback: T,
        noTrailing?: boolean
    ): T & { cancel: () => void };

    /**
     * Debounce: invoke after `delay` ms of no further invocations.
     */
    export function debounce<T extends (...args: unknown[]) => unknown>(
        delay: number,
        callback: T,
        atBegin?: boolean
    ): T & { cancel: () => void };
}

/// <reference types="vite/client" />

declare module '*.json' {
    const value: any;
    export default value;
}

declare global {
    interface Window {
        umami?: {
            track(
                event: string,
                data?: Record<string, string | number | boolean>
            ): void;
        };
    }
}

export {};

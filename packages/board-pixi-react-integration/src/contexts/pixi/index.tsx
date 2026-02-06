import { BaseAppComponents } from '@ue-too/board-pixi-integration';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type PixiCanvasContextType<C extends BaseAppComponents> = {
    setResult: (result: PixiCanvasResult<C>) => void;
    result: PixiCanvasResult<C>;
};

type PixiCanvasUninitializedResult = {
    initialized: false;
};

type PixiCanvasInitializeFailedResult = {
    initialized: true;
    success: false;
};

type PixiCanvasInitializeSuccessResult<C extends BaseAppComponents> = {
    initialized: true;
    success: true;
    components: C;
};

export type PixiCanvasResult<C extends BaseAppComponents> =
    | PixiCanvasUninitializedResult
    | PixiCanvasInitializeFailedResult
    | PixiCanvasInitializeSuccessResult<C>;

export type ResolvedComponents = PixiCanvasRegistry extends {
    components: infer C;
}
    ? C extends BaseAppComponents
        ? C
        : BaseAppComponents
    : BaseAppComponents;

export interface PixiCanvasRegistry {}

const PixiCanvasContext = createContext<
    PixiCanvasContextType<ResolvedComponents>
>({
    setResult: () => {},
    result: { initialized: false },
});

export const usePixiCanvas = () => {
    const context = useContext(PixiCanvasContext);
    if (context == null) {
        throw new Error(
            'PixiCanvasContext not found, make sure you are using PixiCanvasProvider to wrap your component'
        );
    }
    return context;
};

export const PixiCanvasProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const [result, setResult] = useState<PixiCanvasResult<ResolvedComponents>>({
        initialized: false,
    });

    // Validate app state synchronously during render to detect HMR issues
    // During HMR, React Fast Refresh preserves state but the PixiJS app
    // may be destroyed before useEffect cleanup runs
    const validatedResult = useMemo(() => {
        // Check if we have a successful result but the app is destroyed
        if (result.initialized && result.success && result.components) {
            const app = result.components.app;
            // Check if the app or renderer is destroyed/null
            // app.renderer is null when the app is destroyed
            if (!app || !app.renderer) {
                console.log(
                    'PixiCanvasProvider: Detected destroyed app during HMR, returning uninitialized state'
                );
                // Return safe state immediately to prevent accessing destroyed app
                return {
                    initialized: false,
                } as PixiCanvasResult<ResolvedComponents>;
            }
        }
        return result;
    }, [result]);

    // Update state if validation detected a destroyed app
    useEffect(() => {
        if (
            result.initialized &&
            result.success &&
            !validatedResult.initialized
        ) {
            // The validated result was reset but state wasn't, so update it
            setResult({ initialized: false });
        }
    }, [result, validatedResult]);

    return (
        <PixiCanvasContext.Provider
            value={{ setResult, result: validatedResult }}
        >
            {children}
        </PixiCanvasContext.Provider>
    );
};

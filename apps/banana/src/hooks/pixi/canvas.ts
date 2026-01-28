import type { Application, Ticker } from 'pixi.js';
import { useEffect, useMemo, useRef } from 'react';

import { usePixiCanvas } from '@/contexts/pixi';
import { Grid } from '@/knit-grid/grid';
import { PixiGrid } from '@/knit-grid/grid-pixi';

export const useAppTicker = (
    callback: (time: Ticker) => void,
    enabled: boolean = true
) => {
    const { result } = usePixiCanvas();

    useEffect(() => {
        if (
            result.initialized == false ||
            result.success == false ||
            result.components.app == null ||
            !enabled
        ) {
            return;
        }

        result.components.app.ticker.add(callback);

        return () => {
            result.components.app.ticker.remove(callback);
        };
    }, [result, callback, enabled]);
};

export const useToggleKmtInput = (enable: boolean) => {
    const { result } = usePixiCanvas();

    useEffect(() => {
        if (
            result.initialized == false ||
            result.success == false ||
            result.components.kmtInputStateMachine == null
        ) {
            return;
        }

        if (enable) {
            result.components.kmtParser.enable();
        } else {
            result.components.kmtParser.disable();
        }
    }, [result, enable]);
};

export const useCanvasPointerDown = (
    callback: (event: PointerEvent) => void
) => {
    const { result } = usePixiCanvas();

    useEffect(() => {
        if (
            result.initialized == false ||
            result.success == false ||
            result.components.app == null
        ) {
            return;
        }
        result.components.app.canvas.addEventListener('pointerdown', callback);
        return () => {
            result.components.app.canvas.removeEventListener(
                'pointerdown',
                callback
            );
        };
    }, [result, callback]);
};

export const useGrid = () => {
    const { result } = usePixiCanvas();
    const appRef = useRef<Application | null>(null);
    const gridRef = useRef<PixiGrid | null>(null);

    // Extract app from result
    const app =
        result.initialized &&
            result.success &&
            result.components.app != null
            ? result.components.app
            : null;

    // Recreate grid when app changes (needed for HMR since Graphics are tied to renderer)
    const pixiGrid = useMemo(() => {
        // If no app, return null
        if (app == null) {
            return null;
        }

        // If app changed, recreate grid
        if (appRef.current !== app) {
            // Clean up old grid if it exists
            if (gridRef.current != null && appRef.current != null) {
                if (
                    appRef.current.stage != null &&
                    appRef.current.stage.children.includes(gridRef.current)
                ) {
                    appRef.current.stage.removeChild(gridRef.current);
                }
                // Destroy the old grid's Graphics (they're tied to old renderer)
                gridRef.current.destroy({ children: true });
            }

            // Create new grid for new app
            const grid = new Grid(10, 10);
            const gridContainer = new PixiGrid(grid);
            gridContainer.visible = true;
            gridContainer.alpha = 1;
            gridContainer.scale.set(1, 1);
            gridRef.current = gridContainer;
            appRef.current = app;
            // console.log('Created new grid for new app');
            return gridContainer;
        }

        // Return existing grid if app hasn't changed
        return gridRef.current;
    }, [app]);

    useEffect(() => {
        if (app == null || pixiGrid == null) {
            return;
        }

        // Add to app if not already a child
        if (!app.stage.children.includes(pixiGrid)) {
            // console.log('Adding grid to app');
            app.stage.addChild(pixiGrid);
            // Move grid to top so it's visible above other elements
            app.stage.setChildIndex(pixiGrid, app.stage.children.length - 1);

            // Debug: Check if Graphics are rendering
            const bounds = pixiGrid.getBounds();
            const worldBounds = pixiGrid.getBounds(true);
            // console.log('Grid added to stage. Children count:', app.stage.children.length);
            // console.log('Grid bounds (local):', bounds);
            // console.log('Grid bounds (world):', worldBounds);

            if (worldBounds.width > 0 && worldBounds.height > 0) {
                // console.log('Grid has valid bounds');
            } else {
                console.warn('Grid has invalid bounds - Graphics may not be rendering!');
            }
        }

        return () => {
            // Cleanup: remove from current app
            if (app.stage != null && app.stage.children.includes(pixiGrid)) {
                console.log('Removing grid from app during cleanup');
                app.stage.removeChild(pixiGrid);
            }
        };
    }, [app, pixiGrid]);
};

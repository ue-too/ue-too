import { useAutoSave } from '@/hooks/use-auto-save';

/**
 * Activates periodic auto-saving. Renders nothing.
 * Must be a child of both SceneProvider and the PIXI Wrapper.
 */
export function AutoSaveProvider(): null {
    useAutoSave();
    return null;
}

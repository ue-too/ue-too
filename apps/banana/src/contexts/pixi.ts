import { usePixiCanvas, appIsReady } from '@ue-too/board-pixi-react-integration';
import { useMemo } from 'react';

import { BananaAppComponents } from '@/utils/init-app';

/**
 * Access the initialized banana app components from the PixiCanvas context.
 * Returns null when the app is not yet ready.
 */
export function useBananaApp(): BananaAppComponents | null {
  const { result } = usePixiCanvas();

  return useMemo(() => {
    const check = appIsReady(result);
    if (!check.ready) return null;
    return check.components;
  }, [result]);
};

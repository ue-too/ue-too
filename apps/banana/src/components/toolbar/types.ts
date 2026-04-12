/** Application mode for the banana toolbar. */
export type AppMode =
    | 'idle'
    | 'layout'
    | 'layout-deletion'
    | 'train-placement'
    | 'building-placement'
    | 'building-deletion'
    | 'station-placement'
    | 'duplicate-to-side'
    | 'catenary-layout'
    | 'stress-pick';

/** Shared left offset for left-aligned toolbars (main toolbar, layout deletion toolbar). */
export const TOOLBAR_LEFT = 'left-6';

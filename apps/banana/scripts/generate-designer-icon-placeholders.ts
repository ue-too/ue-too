/**
 * Creates `public/designer-icons/<slug>/<slug>.svg` for every Banana icon slot.
 * Re-run after adding icons to `src/assets/icons/lucide.ts` (update LUCIDE_EXPORTS).
 *
 * Usage: `bun run scripts/generate-designer-icon-placeholders.ts`
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { iconExportToDesignerFolder } from '../src/pages/icon-handoff/designer-slug.ts';

const LUCIDE_EXPORTS = [
    'Activity',
    'ArrowDown',
    'ArrowLeftRight',
    'ArrowUp',
    'Bug',
    'Building2',
    'Check',
    'CheckIcon',
    'ChevronDown',
    'ChevronLeft',
    'ChevronRight',
    'ChevronRightIcon',
    'ChevronUp',
    'CircleCheckIcon',
    'CircleIcon',
    'Crosshair',
    'Download',
    'Eraser',
    'Eye',
    'Focus',
    'Gauge',
    'Github',
    'GripHorizontal',
    'Hash',
    'Image',
    'Info',
    'InfoIcon',
    'Landmark',
    'Layers',
    'Link2',
    'List',
    'ListOrdered',
    'Loader2Icon',
    'Map',
    'MapPin',
    'Merge',
    'Mountain',
    'MousePointer2',
    'OctagonXIcon',
    'Package',
    'Pause',
    'Pencil',
    'Play',
    'Plus',
    'Scissors',
    'Settings2',
    'Snowflake',
    'Spline',
    'Sun',
    'TrainFront',
    'TrainTrack',
    'Trash2',
    'TriangleAlertIcon',
    'Upload',
    'Warehouse',
    'X',
] as const;

const CUSTOM_EXPORTS = [
    'BulldozerIcon',
    'ExportSceneIcon',
    'ExportTrackIcon',
    'ExportTrainIcon',
    'ImportSceneIcon',
    'ImportTrackIcon',
    'ImportTrainIcon',
] as const;

const ASSET_SLUGS = ['favicon', 'language-chevron'] as const;

const PLACEHOLDER_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" fill="none" aria-hidden="true">
  <rect x="1" y="1" width="62" height="62" rx="6" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6 4" fill="#f1f5f9"/>
  <text x="32" y="30" text-anchor="middle" font-family="system-ui,sans-serif" font-size="6.5" fill="#64748b">Designer</text>
  <text x="32" y="40" text-anchor="middle" font-family="system-ui,sans-serif" font-size="6.5" fill="#64748b">placeholder</text>
</svg>
`;

const root = join(import.meta.dir, '../public/designer-icons');

function writePlaceholder(slug: string): 'created' | 'skipped' {
    const dir = join(root, slug);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${slug}.svg`);
    const force = process.env.DESIGNER_ICONS_FORCE === '1';
    if (existsSync(file) && !force) {
        return 'skipped';
    }
    writeFileSync(file, PLACEHOLDER_SVG, 'utf8');
    return 'created';
}

let created = 0;
let skipped = 0;

for (const name of CUSTOM_EXPORTS) {
    const r = writePlaceholder(iconExportToDesignerFolder(name));
    if (r === 'created') created += 1;
    else skipped += 1;
}
for (const name of LUCIDE_EXPORTS) {
    const r = writePlaceholder(iconExportToDesignerFolder(name));
    if (r === 'created') created += 1;
    else skipped += 1;
}
for (const slug of ASSET_SLUGS) {
    const r = writePlaceholder(slug);
    if (r === 'created') created += 1;
    else skipped += 1;
}

console.log(
    `Designer icons: ${created} written, ${skipped} skipped (set DESIGNER_ICONS_FORCE=1 to overwrite). Root: public/designer-icons/`
);

import { iconExportToDesignerFolder } from './designer-slug';

export type IconHandoffComponentRow = {
    kind: 'component';
    category: 'custom' | 'lucide';
    exportName: string;
    designerSlug: string;
};

export type IconHandoffAssetDescKey = 'favicon' | 'languageChevron';

export type IconHandoffAssetRow = {
    kind: 'asset';
    descKey: IconHandoffAssetDescKey;
    designerSlug: string;
    currentSrc?: string;
};

export type IconHandoffRow = IconHandoffComponentRow | IconHandoffAssetRow;

function componentRow(
    exportName: string,
    category: 'custom' | 'lucide'
): IconHandoffComponentRow {
    return {
        kind: 'component',
        exportName,
        category,
        designerSlug: iconExportToDesignerFolder(exportName),
    };
}

const CUSTOM_ROWS: IconHandoffComponentRow[] = [
    componentRow('BulldozerIcon', 'custom'),
    componentRow('ExportTrackIcon', 'custom'),
    componentRow('ImportTrackIcon', 'custom'),
    componentRow('ExportTrainIcon', 'custom'),
    componentRow('ImportTrainIcon', 'custom'),
    componentRow('ExportSceneIcon', 'custom'),
    componentRow('ImportSceneIcon', 'custom'),
];

const LUCIDE_ROWS: IconHandoffComponentRow[] = [
    componentRow('Activity', 'lucide'),
    componentRow('ArrowDown', 'lucide'),
    componentRow('Clock', 'lucide'),
    componentRow('ArrowLeftRight', 'lucide'),
    componentRow('ArrowUp', 'lucide'),
    componentRow('Bug', 'lucide'),
    componentRow('Building2', 'lucide'),
    componentRow('Check', 'lucide'),
    componentRow('CheckIcon', 'lucide'),
    componentRow('ChevronDown', 'lucide'),
    componentRow('ChevronLeft', 'lucide'),
    componentRow('ChevronRight', 'lucide'),
    componentRow('ChevronRightIcon', 'lucide'),
    componentRow('ChevronUp', 'lucide'),
    componentRow('CircleCheckIcon', 'lucide'),
    componentRow('CircleIcon', 'lucide'),
    componentRow('Crosshair', 'lucide'),
    componentRow('Download', 'lucide'),
    componentRow('Eraser', 'lucide'),
    componentRow('Eye', 'lucide'),
    componentRow('FilePlus', 'lucide'),
    componentRow('Focus', 'lucide'),
    componentRow('FolderOpen', 'lucide'),
    componentRow('Gauge', 'lucide'),
    componentRow('Github', 'lucide'),
    componentRow('GripHorizontal', 'lucide'),
    componentRow('Hash', 'lucide'),
    componentRow('Image', 'lucide'),
    componentRow('Info', 'lucide'),
    componentRow('InfoIcon', 'lucide'),
    componentRow('Landmark', 'lucide'),
    componentRow('Layers', 'lucide'),
    componentRow('Link2', 'lucide'),
    componentRow('List', 'lucide'),
    componentRow('ListOrdered', 'lucide'),
    componentRow('Loader2Icon', 'lucide'),
    componentRow('Map', 'lucide'),
    componentRow('MapPin', 'lucide'),
    componentRow('Merge', 'lucide'),
    componentRow('Mountain', 'lucide'),
    componentRow('MousePointer2', 'lucide'),
    componentRow('OctagonXIcon', 'lucide'),
    componentRow('Package', 'lucide'),
    componentRow('Pause', 'lucide'),
    componentRow('Pencil', 'lucide'),
    componentRow('Play', 'lucide'),
    componentRow('Plus', 'lucide'),
    componentRow('Save', 'lucide'),
    componentRow('Scissors', 'lucide'),
    componentRow('Settings2', 'lucide'),
    componentRow('Signal', 'lucide'),
    componentRow('Snowflake', 'lucide'),
    componentRow('Spline', 'lucide'),
    componentRow('Sun', 'lucide'),
    componentRow('Timer', 'lucide'),
    componentRow('TrainFront', 'lucide'),
    componentRow('TrainTrack', 'lucide'),
    componentRow('Trash2', 'lucide'),
    componentRow('TriangleAlertIcon', 'lucide'),
    componentRow('Upload', 'lucide'),
    componentRow('Warehouse', 'lucide'),
    componentRow('X', 'lucide'),
];

const ASSET_ROWS: IconHandoffAssetRow[] = [
    {
        kind: 'asset',
        descKey: 'favicon',
        designerSlug: 'favicon',
        currentSrc: '/favicon.svg',
    },
    {
        kind: 'asset',
        descKey: 'languageChevron',
        designerSlug: 'language-chevron',
    },
];

/** Ordered list for the handoff page: custom → Lucide (alphabetical by export name) → other assets */
export const ICON_HANDOFF_ROWS: IconHandoffRow[] = [
    ...CUSTOM_ROWS,
    ...LUCIDE_ROWS,
    ...ASSET_ROWS,
];

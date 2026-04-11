/**
 * English strings for the /icon-handoff page (nested under translation.iconHandoff).
 */
export const iconHandoff = {
    title: 'Icon handoff',
    intro:
        'Visual inventory for the {{appName}} app: each row shows the icon as implemented today, a slot for the designer-delivered SVG, and what it is used for. Lucide reference:',
    lucideLinkLabel: 'lucide.dev',
    introClosing: '.',
    backToLanding: '← Back to landing',
    conventionTitle: 'Designer file convention',
    conventionP1:
        'For each icon, add or replace the SVG at public/designer-icons/<slug>/<slug>.svg. The slug matches the folder name and file basename (see the second line in each row).',
    conventionP2:
        'React export names are converted with iconExportToDesignerFolder() in src/pages/icon-handoff/designer-slug.ts (e.g. ExportSceneIcon → export-scene-icon).',
    conventionP3:
        'Run bun run generate:designer-icons to create missing placeholder files. Existing SVGs are not overwritten.',
    conventionP4:
        'Use DESIGNER_ICONS_FORCE=1 bun run generate:designer-icons to overwrite every slot with the default placeholder again.',
    tableName: 'Name',
    tableCurrent: 'Current',
    tableDesigner: 'Designer',
    tableUsedFor: 'Used for',
    inlineSvgNote: 'Inline SVG in source',
    footerIntro: 'Narrative inventory also lives in',
    footerFile: 'ICONS.md',
    footerOutro: 'at the app root.',
    sectionCustomTitle: 'Custom app icons',
    sectionCustomSubtitle:
        'First-party React SVG components under src/assets/icons/ — primary targets for bespoke artwork.',
    sectionLucideTitle: 'Lucide icons',
    sectionLucideSubtitle:
        'Re-exported from lucide-react via src/assets/icons/lucide.ts. Designer SVGs here are for reference or future replacement assets.',
    sectionOtherTitle: 'Other graphical marks',
    sectionOtherSubtitle:
        'Not imported from @/assets/icons; included so artwork can still be tracked in the same folder layout.',
    desc: {
        BulldozerIcon:
            'Toggle track layout deletion mode (remove track segments). Shown when layout editing is active. Source note in source: adapted from Tabler Icons.',
        ExportTrackIcon: 'Export tracks and stations to JSON (export submenu).',
        ImportTrackIcon: 'Import tracks and stations from JSON.',
        ExportTrainIcon: 'Export trains (formations / train data) to JSON.',
        ImportTrainIcon: 'Import trains from JSON.',
        ExportSceneIcon: 'Export full scene (everything bundled).',
        ImportSceneIcon: 'Import full scene from JSON.',
        Activity: 'Debug panel: toggle FPS / performance stats overlay.',
        ArrowDown:
            'Formation editor: move a composition segment down in order (swap with next).',
        ArrowLeftRight:
            'Train panel: reverse travel direction of the selected train. Formation editor: reverse order of cars in a formation (“reverse composition”).',
        ArrowUp:
            'Formation editor: move a composition segment up in order (swap with previous).',
        Bug: 'Main toolbar: open / close the debug panel.',
        Building2:
            'Reserved: main toolbar button for building placement is commented out in code; icon kept for when that mode returns.',
        Check:
            'Station list: confirm finished picking platforms for a station (exit platform-assignment mode).',
        CheckIcon:
            'Dropdown menu: shows selected item in selectable menu rows (shadcn pattern).',
        Clock:
            'Main toolbar: open / close timetable panel (shift scheduling, routes, and auto-driving assignments).',
        ChevronDown:
            'Formation editor: collapsed state chevron on formation cards; append selected stock car / depot formation to the end of the composition.',
        ChevronLeft:
            'Simulation time control: decrease time speed (step down through speed presets).',
        ChevronRight:
            'Simulation time control: increase time speed (step up through speed presets).',
        ChevronRightIcon:
            'Dropdown menu: submenu affordance (row has a nested menu).',
        ChevronUp:
            'Formation editor: expanded state chevron on formation cards; prepend selected stock car / depot formation to the start of the composition.',
        CircleCheckIcon: 'Toast (Sonner): success notification icon.',
        CircleIcon:
            'Dropdown menu: radio-style unselected bullet for single-choice items.',
        Crosshair:
            'Train panel: start/stop camera follow on the selected train. Station list: pan / locate the map on a station.',
        Download:
            'Export submenu: parent button that opens import/export flyout. Terrain editor: export terrain JSON. Train editor: export car definition JSON (needs valid bogies).',
        Eraser: 'Terrain editor: erase water brush mode (remove painted water).',
        Eye: 'Debug panel: toggle terrain X-ray (see through / debug terrain rendering).',
        Focus:
            'Train panel: focus camera on the selected train (animated zoom/pan to train).',
        Gauge:
            'Export submenu: import car definition from train editor (speedometer metaphor for vehicle spec).',
        Github: 'Landing page footer: link to {{appName}} app source on GitHub.',
        GripHorizontal:
            'Train editor: toggle edit train car image mode (resize/move sprite).',
        Hash: 'Debug panel: toggle track joint numbers overlay.',
        Image: 'Train editor: import raster image onto the car body.',
        Info: 'Map attribution bar: toggle expanded map attribution (OpenStreetMap / Protomaps credits).',
        InfoIcon: 'Toast: info notification icon.',
        Landmark:
            'Main toolbar: open / close station list panel. Debug panel: toggle station location markers.',
        Layers:
            'Main toolbar: toggle elevation gradient overlay. Formation editor: section label for formations in depot. Terrain editor: toggle map overlay under the paint canvas.',
        Link2:
            'Formation editor: badge and button for coupling compatible trains; debug panel: coupling proximity lines overlay.',
        List: 'Main toolbar: open / close train list panel.',
        ListOrdered:
            'Main toolbar: open / close formation editor. Debug panel: toggle segment IDs on track.',
        Loader2Icon: 'Toast: loading state (spinner).',
        Map: 'Main toolbar (when enabled): show / hide basemap under the canvas.',
        MapPin: 'Debug panel: toggle station stop positions overlay.',
        Merge:
            'Formation editor: consolidate nested formations into a flat composition (when nested groups exist).',
        Mountain:
            'Terrain controls: terrain fill visibility toggle. Export submenu: import terrain data.',
        MousePointer2:
            'Train editor: edit bogies mode (place/adjust wheel positions).',
        OctagonXIcon: 'Toast: error notification icon.',
        Package:
            'Terrain editor: export terrain as scene bundle for use in the main {{appName}} app.',
        Pause:
            'Simulation time control: pause the world clock (shown while running).',
        Pencil:
            'Depot: rename a car in stock. Formation editor: rename formation (inline edit trigger).',
        Play:
            'Simulation time control: resume the world clock (shown while paused).',
        Plus:
            'Depot: create new car in stock; duplicate template into stock. Formation editor: create new formation. Train editor: add bogie mode.',
        Scissors:
            'Formation editor: decouple trains at a boundary between cars (split consist at scissors control).',
        Settings2:
            'Station list: enter pick platforms mode to assign platforms to a station.',
        Snowflake:
            'Terrain controls: white occlusion / snow-style terrain shading toggle.',
        Spline:
            'Main toolbar: show / hide preview curve arcs when laying track.',
        Sun: 'Lighting widget: adjust sun angle (0–360°) for scene lighting.',
        TrainFront:
            'Main toolbar: train placement mode. Formation selector: label next to Formation dropdown. Formation editor: on-track formations section header. Debug panel: toggle formation IDs overlay.',
        TrainTrack:
            'Main toolbar: enter / exit track layout editing mode.',
        Trash2:
            'Remove selected train; delete station; delete formation or composition row; remove car from depot. Primary destructive list icon across panels.',
        TriangleAlertIcon: 'Toast: warning notification icon.',
        Upload:
            'Terrain editor: import terrain JSON. Train editor: import car definition JSON.',
        Warehouse:
            'Main toolbar: depot panel (car stock). Also used for station placement mode (warehouse / yard metaphor).',
        X: 'Close draggable panels. Station list: cancel platform-picking mode.',
        favicon:
            'Browser tab favicon for {{appName}} (public/favicon.svg). Replace the shipped favicon when branding updates.',
        languageChevron:
            'Tiny inline SVG beside the locale label in LanguageSwitcher.tsx (opens language menu). Not part of the Lucide barrel.',
    },
    assetLabel: {
        favicon: 'Browser favicon',
        languageChevron: 'Language switcher chevron',
    },
} as const;

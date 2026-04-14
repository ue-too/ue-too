import { iconHandoff as iconHandoffStringsEn } from './icon-handoff-en';

const en = {
    translation: {
        // Toolbar - Category Rail
        toolbarCategoryDrawing: 'Drawing Tools',
        toolbarCategoryTrains: 'Train Management',
        toolbarCategoryInfra: 'Infrastructure & Visualization',
        toolbarCategoryScene: 'Scene & Files',
        toolbarCategoryDebug: 'Debug & View',

        // Toolbar - Layout
        startLayout: 'Start Layout',
        endLayout: 'End Layout',
        deleteTrack: 'Delete Track',
        endDeletion: 'End Deletion',
        duplicateTrackToSide: 'Duplicate Track to Side',
        catenaryLayout: 'Catenary Layout',
        jointDirection: 'Joint Direction',

        // Toolbar - Mode Exit Chip
        exitMode: 'Exit',
        modeDrawingLayout: 'Drawing Tracks',
        modeDeletingTrack: 'Deleting Tracks',
        modePlacingTrain: 'Placing Train',
        modePlacingStation: 'Placing Station',
        modeDuplicatingTrack: 'Duplicating Track',
        modeCatenaryLayout: 'Placing Catenary',
        modePlacingBuilding: 'Placing Building',
        modeDeletingBuilding: 'Deleting Building',
        modeSingleSpinePlatform: 'Placing Single-Side Platform',
        modeDualSpinePlatform: 'Placing Dual-Side Platform',
        modeJointDirection: 'Joint Direction',

        // Toolbar - Train
        placeTrain: 'Place Train',
        endPlacement: 'End Placement',
        trainList: 'Train List',
        closeTrainList: 'Close Train List',
        openDepot: 'Open Depot',
        closeDepot: 'Close Depot',
        editFormations: 'Edit Formations',
        closeFormations: 'Close Formations',

        // Toolbar - Building
        placeBuilding: 'Place Building',
        deleteBuilding: 'Delete Building',

        // Toolbar - Station
        placeStation: 'Place Station',
        endStationPlacement: 'End Station Placement',
        openStationList: 'Open Station List',
        closeStationList: 'Close Station List',

        // Toolbar - Visualization
        showElevationGradient: 'Show Elevation Gradient',
        hideElevationGradient: 'Hide Elevation Gradient',
        showPreviewCurveArcs: 'Show Preview Curve Arcs',
        hidePreviewCurveArcs: 'Hide Preview Curve Arcs',
        elevationGradientLabel: 'Elevation Gradient',
        curveArcsLabel: 'Curve Arcs',
        mapLabel: 'Map',
        importExport: 'Import / Export',
        showMap: 'Show Map',
        hideMap: 'Hide Map',
        openDebug: 'Open Debug',
        closeDebug: 'Close Debug',
        sunAngle: 'Sun Angle',
        terrainFill: 'Terrain',
        terrainOpacity: 'Terrain Opacity',
        whiteOcclusion: 'White Occlusion',
        elevation: 'Elev',

        // Export/Import
        exportTracksStations: 'Export Tracks + Stations',
        importTracksStations: 'Import Tracks + Stations',
        exportTrains: 'Export Trains (cars, formations, positions)',
        importTrains: 'Import Trains',
        exportAll: 'Export All (tracks + trains + stations + timetable)',
        importAll: 'Import All (tracks + trains + stations + timetable)',
        importTerrain: 'Import Terrain',
        invalidTerrainData: 'Invalid terrain data: {{error}}',
        importCarDefinitionFromEditor:
            'Import Car Definition (from Train Editor)',
        importCarDefinitionFromLibrary: 'Import Car Definition (from Library)',

        // Scene Management
        sceneNotFound: 'Scene not found in storage',
        sceneDataInvalid: 'Scene data invalid: {{error}}',
        sceneLoaded: 'Loaded "{{name}}"',
        sceneRestoreFailed: 'Failed to restore scene',
        scenePickerTitle: 'Saved Scenes',
        scenePickerDescription:
            'Select a scene to continue, or create a new one.',
        newScene: 'New Scene',
        saveScene: 'Save Scene',
        savedScenes: 'Saved Scenes',
        noSavedScenes: 'No saved scenes yet.',
        lastActive: 'last active',
        justNow: 'just now',
        minutesAgo: '{{count}}m ago',
        hoursAgo: '{{count}}h ago',
        daysAgo: '{{count}}d ago',
        confirmDelete: 'Delete',
        autoSaveInterval: 'Auto-save interval',
        autoSave1Min: '1 minute',
        autoSave3Min: '3 minutes',
        autoSave5Min: '5 minutes',
        autoSave10Min: '10 minutes',
        autoSaveToast: '"{{name}}" auto-saved',

        // Track-aligned platform hints
        hintPickStart: 'Click on a track to set the start point',
        hintPickEnd: 'Click along the track to set the end point',
        hintDrawOuter:
            'Click to draw the platform edge — close near the start anchor to finish',
        hintDualPickSpineAStart: 'Click on a track to set spine A start',
        hintDualPickSpineAEnd: 'Click along the track to set spine A end',
        hintDualPickSpineBStart:
            'Click the opposite track to set spine B start',
        hintDualPickSpineBEnd: 'Click along the track to set spine B end',
        hintDualDrawCap1:
            'Click to draw the first end cap — close near the snap ring to finish',
        hintDualDrawCap2:
            'Click to draw the second end cap — close near the snap ring to finish',
        hintPlatformCreated: 'Platform created',

        // Validation errors
        invalidTrackData: 'Invalid track data: {{error}}',
        invalidTrainData: 'Invalid train data: {{error}}',
        invalidSceneData: 'Invalid scene data: {{error}}',
        invalidCarDefinition: 'Invalid car definition: {{error}}',

        // Train Panel
        trains: 'Trains',
        placedTrains: 'Placed trains',
        car_one: '{{count}} car',
        car_other: '{{count}} cars',
        controls: 'Controls',
        throttleP5: 'Throttle P5',
        neutral: 'Neutral',
        switchDirection: 'Switch Direction',
        removeSelectedTrain: 'Remove Selected Train',
        focusOnSelectedTrain: 'Focus on Selected Train',
        followSelectedTrain: 'Follow Selected Train',
        stopFollowing: 'Stop Following',

        // Depot Panel
        depot: 'Depot',
        noCarsInStock: 'No cars in stock',
        bogieCount: '{{count}} bogies',
        templates: 'Templates',
        carType: 'Type',
        carType_locomotive: 'Locomotive',
        carType_coach: 'Coach',
        carType_motor: 'Motor',
        carType_trailer: 'Trailer',
        carType_freight: 'Freight',
        carType_cab_car: 'Cab Car',

        // Station List Panel
        stations: 'Stations',
        createEmptyStation: 'Create empty station',
        noStations: 'No stations',
        platform_one: '{{count}} platform',
        platform_other: '{{count}} platforms',
        trackAlignedPlatform_one: '{{count}} track platform',
        trackAlignedPlatform_other: '{{count}} track platforms',
        donePickingPlatforms: 'Done picking platforms',
        pickPlatformsToAdd: 'Pick platforms to add',
        panToStation: 'Pan to station',
        deleteStation: 'Delete station',
        addSingleSpinePlatform: 'Add single-side platform',
        addDualSpinePlatform: 'Add dual-side platform',
        nearbyPlatforms: 'Nearby platforms',
        cancel: 'Cancel',
        noNearbyPlatforms: 'No nearby platforms from other stations',
        platformTrackInfo: 'Platform {{platformId}} — track {{trackId}}',
        fromStationDistance: 'from {{name}} · {{distance}}m away',
        stationFallback: 'Station {{id}}',

        // Formation Selector
        formation: 'Formation',
        defaultFormation: 'Default (4 cars)',

        // Track Style Selector
        trackStyle: 'Track Style',
        ballasted: 'Ballasted',
        slabElevated: 'Slab (Elevated)',
        electrified: 'Electrified',
        bed: 'Bed',
        bedWidth: 'Bed Width',
        snapBuffer: 'Snap Buffer',
        trackGauge: 'Track Gauge',
        customGauge: 'Custom',
        gaugeLabels: 'Gauge Labels',

        // Building Options Panel
        building: 'Building',
        small: 'Small',
        medium: 'Medium',
        large: 'Large',
        lShape: 'L-Shape',
        ground: 'Ground',
        above1: 'Above 1',
        above2: 'Above 2',
        above3: 'Above 3',
        height: 'Height',
        level: 'lv',

        // Debug Panel
        debug: 'Debug',
        jointNumbers: 'Joint numbers',
        segmentIds: 'Segment IDs',
        formationIds: 'Formation IDs',
        stationStops: 'Station stops',
        stationLocations: 'Station locations',
        showBogies: 'Bogies',
        terrainXray: 'Terrain X-ray',
        fpsStats: 'FPS stats',

        // Layout Deletion Toolbar (deleteTrack / endDeletion already defined above)

        // Train Editor
        editBogies: 'Edit Bogies',
        endEdit: 'End Edit',
        addBogie: 'Add Bogie',
        endAdd: 'End Add',
        importImage: 'Import Image',
        editImage: 'Edit Image',
        endImageEdit: 'End Image Edit',
        exportCarDefinition: 'Export Car Definition',
        importCarDefinition: 'Import Car Definition',
        saveToLibrary: 'Save to Library',
        loadFromLibrary: 'Load from Library',
        save: 'Save',
        carDefinitionLibraryTitle: 'Car Definition Library',
        carDefinitionLibraryDescription: 'Pick a saved car definition to load.',
        noSavedCarDefinitions: 'No saved car definitions yet.',
        carDefinitionNamePlaceholder: 'Car name',
        saveCarDefinitionTitle: 'Save car definition',
        saveCarDefinitionDescription:
            'Name this car to save it to the library.',
        saveCarDefinitionUpdateTitle: 'Update car definition',
        saveCarDefinitionUpdateDescription:
            'Update the existing entry or rename it.',
        untitledCar: 'Untitled car {{count}}',
        needAtLeast2Bogies: 'Need at least 2 bogies to export.',
        failedToParseJson: 'Failed to parse JSON: {{error}}',
        invalidFileMissingBogieOffsets: 'Invalid file: missing bogieOffsets.',

        // Signal Panel
        signals: 'Signals',
        openSignals: 'Signals',
        closeSignals: 'Close Signals',
        addSignal: 'Add Signal',
        segmentNumber: 'Segment #',
        signalsList: 'Signals',
        addBlock: 'Add Block',
        entrySignal: 'Entry signal ID',
        exitSignal: 'Exit signal ID',
        autoFillAndCreate: 'Auto-fill & Create',
        preview: 'Preview',
        previewAutoFillTooltip: 'Preview auto-filled segments without creating',
        enterValidSignalIds: 'Enter valid signal IDs',
        noPathBetweenSignals: 'No path found between signals',
        manualSegments: 'Manual segments',
        blocksList: 'Blocks',

        // Timetable Panel
        timetable: 'Timetable',
        openTimetable: 'Open Timetable',
        closeTimetable: 'Close Timetable',
        routes: 'Routes',
        noRoutes: 'No routes defined',
        addRoute: 'Add Route',
        routeName: 'Route name',
        jointSequence: 'Joint numbers (comma-separated)',
        shifts: 'Shifts',
        noShifts: 'No shift templates',
        addShift: 'Add Shift',
        shiftName: 'Shift name',
        stops: 'Stops',
        stationPlaceholder: 'Station...',
        arrivalTime: 'Arr HH:MM',
        departureTime: 'Dep HH:MM',
        platformPlaceholder: 'Platform...',
        routePlaceholder: 'Route...',
        addStop: '+ Stop',
        assignments: 'Assignments',
        noAssignments: 'No assignments',
        assignShift: 'Assign Shift',
        selectFormation: 'Select formation',
        selectShift: 'Select shift',
        suspended: 'suspended',
        activeDrivers: 'Active Drivers',
        noActiveDrivers: 'No active drivers',
        stopCount: '{{count}} stops',
        jointCount: '{{count}} joints',
        removeRoute: 'Remove route',
        removeShift: 'Remove shift',
        removeAssignment: 'Remove assignment',
        exportTimetable: 'Export Timetable',
        importTimetable: 'Import Timetable',
        invalidTimetableData: 'Invalid timetable data: {{error}}',

        // Formation Editor
        formations: 'Formations',
        onTrack: 'On track',
        inDepot: 'In depot',
        noFormationsInDepot: 'No formations in depot.',
        clickPlusToCreate: 'Click + to create one.',
        addCarsToDepotFirst: 'Add cars to the depot first.',
        trainLabel: 'Train {{number}}',
        nested: 'nested',
        containsNestedFormations: 'Contains nested formations',
        nestedFormation: 'Nested formation',
        composition: 'Composition',
        consolidate: 'Consolidate',
        consolidateTooltip: 'Flatten nested formations into individual cars',
        reverseTooltip: 'Reverse the order of children',
        reverseNestedTooltip: "Reverse the order of this formation's children",
        flipChildDirectionTooltip: 'Flip the direction of this child',
        couplable: 'couplable',
        couple: 'Couple',
        coupleWith: 'Couple with Train {{number}}',
        couplingDepthExceeded:
            'Cannot couple: formation nesting too deep. Consolidate one of the formations first.',
        proximityLines: 'Coupling proximity',
        renameFormation: 'Click to rename',
        renameCar: 'Click to rename',
        addFromStock: 'Add from stock',
        addFormation: 'Add formation',

        // Landing Page
        nextStop: 'Next Stop',
        landingTagline1:
            'A 2D top-down railway simulator right in the browser.',
        landingTagline2: 'tracks, stations, trains, and more.',
        openSimulator: 'Open Simulator',
        openTutorial: 'tutorial (WIP)',
        openCarEditor: 'Open Car Editor',
        build: 'Build',
        simulate: 'Simulate',
        featureTrackDrawing: 'Bézier Track Drawing provides high flexibility',
        featureTerrain: '2D but not flat, subway? checked!',
        featureStations: 'Stations & Buildings (WIP)',
        featureTrainSim:
            'Train Simulation, want to drive the train yourself? Not a problem!',
        featureFormations: 'Flexible Train Formations',
        featureNavigation: 'Smooth Navigation',
        featureImportExport:
            'Import & Export, cloud and browser-side auto-save in development',
        featureDynamicFormations: 'Couple and decouple trains dynamically',
        featureGranularity: 'Granular timetable editing (WIP)',
        builtWithFooter:
            'Built with <ueToo>ue-too</ueToo> · <issues>Feedback</issues>',
        cjkFontCreditFooter:
            'CJK pixel font: <cubic11>Cubic 11</cubic11> by ACh-K',
        motionOn: 'Motion: on',
        motionOff: 'Motion: off',
        enableAnimations: 'Enable animations',
        reduceAnimations: 'Reduce animations',

        // Analytics Notice
        analyticsNotice:
            'This site uses basic event tracking to improve the experience. No personal data is collected.',

        // 404 Page
        notFoundMessage: "This track doesn't lead anywhere.",
        backToHome: 'Home',

        // Icon handoff (/icon-handoff)
        iconHandoff: iconHandoffStringsEn,
    },
} as const;

export default en;

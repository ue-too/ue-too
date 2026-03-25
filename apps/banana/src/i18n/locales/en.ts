import { iconHandoff as iconHandoffStringsEn } from './icon-handoff-en';

const en = {
    translation: {
        // Toolbar - Layout
        startLayout: 'Start Layout',
        endLayout: 'End Layout',
        deleteTrack: 'Delete Track',
        endDeletion: 'End Deletion',

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
        importCarDefinitionFromEditor: 'Import Car Definition (from Train Editor)',

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

        // Station List Panel
        stations: 'Stations',
        noStations: 'No stations',
        platform_one: '{{count}} platform',
        platform_other: '{{count}} platforms',
        donePickingPlatforms: 'Done picking platforms',
        pickPlatformsToAdd: 'Pick platforms to add',
        panToStation: 'Pan to station',
        deleteStation: 'Delete station',
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
        needAtLeast2Bogies: 'Need at least 2 bogies to export.',
        failedToParseJson: 'Failed to parse JSON: {{error}}',
        invalidFileMissingBogieOffsets: 'Invalid file: missing bogieOffsets.',

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
        assignments: 'Assignments',
        noAssignments: 'No assignments',
        assignShift: 'Assign Shift',
        selectFormation: 'Select formation',
        selectShift: 'Select shift',
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
        couplable: 'couplable',
        couple: 'Couple',
        coupleWith: 'Couple with Train {{number}}',
        couplingDepthExceeded: 'Cannot couple: formation nesting too deep. Consolidate one of the formations first.',
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
        build: 'Build',
        simulate: 'Simulate',
        featureTrackDrawing: 'Bézier Track Drawing provides high flexibility',
        featureTerrain: '2D but not flat, subway? checked!',
        featureStations: 'Stations & Buildings (WIP)',
        featureTrainSim: 'Train Simulation, want to drive the train yourself? Not a problem!',
        featureFormations: 'Flexible Train Formations',
        featureNavigation: 'Smooth Navigation',
        featureImportExport: 'Import & Export, cloud and browser-side auto-save in development',
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

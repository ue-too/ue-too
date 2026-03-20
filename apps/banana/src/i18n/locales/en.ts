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
        exportAll: 'Export All (tracks + trains + stations)',
        importAll: 'Import All (tracks + trains + stations)',
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
        addFromStock: 'Add from stock',
    },
} as const;

export default en;

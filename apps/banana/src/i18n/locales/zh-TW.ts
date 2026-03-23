const zhTW = {
    translation: {
        // Toolbar - Layout
        startLayout: '開始佈軌',
        endLayout: '結束佈軌',
        deleteTrack: '刪除軌道',
        endDeletion: '結束刪除',

        // Toolbar - Train
        placeTrain: '放置列車',
        endPlacement: '結束放置',
        trainList: '列車清單',
        closeTrainList: '關閉列車清單',
        openDepot: '開啟車庫',
        closeDepot: '關閉車庫',
        editFormations: '編輯編組',
        closeFormations: '關閉編組',

        // Toolbar - Building
        placeBuilding: '放置建築',
        deleteBuilding: '刪除建築',

        // Toolbar - Station
        placeStation: '放置車站',
        endStationPlacement: '結束放置車站',
        openStationList: '開啟車站清單',
        closeStationList: '關閉車站清單',

        // Toolbar - Visualization
        showElevationGradient: '顯示高度漸層',
        hideElevationGradient: '隱藏高度漸層',
        showPreviewCurveArcs: '顯示預覽曲線弧',
        hidePreviewCurveArcs: '隱藏預覽曲線弧',
        showMap: '顯示地圖',
        hideMap: '隱藏地圖',
        openDebug: '開啟除錯選項',
        closeDebug: '關閉除錯選項',
        sunAngle: '日照角度',
        terrainFill: '地形',
        terrainOpacity: '地形透明度',
        whiteOcclusion: '白色遮罩',
        elevation: '高度',

        // Export/Import
        exportTracksStations: '匯出軌道 + 車站',
        importTracksStations: '匯入軌道 + 車站',
        exportTrains: '匯出列車（車輛、編組、位置）',
        importTrains: '匯入列車',
        exportAll: '匯出全部（軌道 + 列車 + 車站）',
        importAll: '匯入全部（軌道 + 列車 + 車站）',
        importTerrain: '匯入地形',
        invalidTerrainData: '無效的地形資料：{{error}}',
        importCarDefinitionFromEditor: '匯入車輛定義（從列車編輯器）',

        // Validation errors
        invalidTrackData: '無效的軌道資料：{{error}}',
        invalidTrainData: '無效的列車資料：{{error}}',
        invalidSceneData: '無效的場景資料：{{error}}',
        invalidCarDefinition: '無效的車輛定義：{{error}}',

        // Train Panel
        trains: '列車',
        placedTrains: '已放置的列車',
        car_one: '{{count}} 節車廂',
        car_other: '{{count}} 節車廂',
        controls: '控制',
        throttleP5: '動力 P5',
        neutral: '空檔',
        switchDirection: '切換方向',
        removeSelectedTrain: '移除選取的列車',
        focusOnSelectedTrain: '聚焦選取的列車',
        followSelectedTrain: '跟隨選取的列車',
        stopFollowing: '停止跟隨',

        // Depot Panel
        depot: '車庫',
        noCarsInStock: '車庫中沒有車輛',
        bogieCount: '{{count}} 個轉向架',
        templates: '範本',

        // Station List Panel
        stations: '車站',
        noStations: '沒有車站',
        platform_one: '{{count}} 個月台',
        platform_other: '{{count}} 個月台',
        donePickingPlatforms: '完成選取月台',
        pickPlatformsToAdd: '選取要加入的月台',
        panToStation: '移至車站',
        deleteStation: '刪除車站',
        nearbyPlatforms: '附近月台',
        cancel: '取消',
        noNearbyPlatforms: '附近沒有其他車站的月台',
        platformTrackInfo: '月台 {{platformId}} — 軌道 {{trackId}}',
        fromStationDistance: '來自 {{name}} · {{distance}}m',
        stationFallback: '車站 {{id}}',

        // Formation Selector
        formation: '編組',
        defaultFormation: '預設（4 節車廂）',

        // Track Style Selector
        trackStyle: '軌道樣式',
        ballasted: '碎石道床',
        slabElevated: '板式（高架）',
        electrified: '電氣化',
        bed: '路基',
        bedWidth: '路基寬度',
        snapBuffer: '吸附距離',

        // Building Options Panel
        building: '建築',
        small: '小',
        medium: '中',
        large: '大',
        lShape: 'L 型',
        ground: '地面',
        above1: '地上 1',
        above2: '地上 2',
        above3: '地上 3',
        height: '高度',
        level: '層',

        // Debug Panel
        debug: '除錯',
        jointNumbers: '接頭編號',
        segmentIds: '區段 ID',
        formationIds: '編組 ID',
        stationStops: '停靠站',
        stationLocations: '車站位置',
        terrainXray: '地形透視',
        fpsStats: 'FPS 統計',

        // Train Editor
        editBogies: '編輯轉向架',
        endEdit: '結束編輯',
        addBogie: '新增轉向架',
        endAdd: '結束新增',
        importImage: '匯入圖片',
        editImage: '編輯圖片',
        endImageEdit: '結束圖片編輯',
        exportCarDefinition: '匯出車輛定義',
        importCarDefinition: '匯入車輛定義',
        needAtLeast2Bogies: '需要至少 2 個轉向架才能匯出。',
        failedToParseJson: '解析 JSON 失敗：{{error}}',
        invalidFileMissingBogieOffsets: '無效的檔案：缺少 bogieOffsets。',

        // Formation Editor
        formations: '編組',
        onTrack: '在軌道上',
        inDepot: '在車庫中',
        noFormationsInDepot: '車庫中沒有編組。',
        clickPlusToCreate: '按下 + 建立一個。',
        addCarsToDepotFirst: '請先將車輛加入車庫。',
        trainLabel: '列車 {{number}}',
        nested: '巢狀',
        containsNestedFormations: '包含巢狀編組',
        nestedFormation: '巢狀編組',
        composition: '組成',
        consolidate: '合併',
        consolidateTooltip: '將巢狀編組扁平展開為個別車輛',
        renameFormation: '點擊以重新命名',
        addFromStock: '從車庫加入',
        addFormation: '加入編組',

        // Landing Page
        nextStop: '下一站',
        landingTagline1: '直接在瀏覽器裡面就能使用的 2D 俯視鐵道模擬器。',
        landingTagline2: '軌道、車站、列車、自由組合',
        openSimulator: '開啟模擬器',
        build: '建造',
        simulate: '模擬',
        featureTrackDrawing: '高自由度的佈軌系統',
        featureTerrain: '平面但不扁平，分層的高度系統，想要地下鐵？沒問題！',
        featureStations: '車站與建築（施工中）',
        featureTrainSim: '列車運行模擬，想要親自駕駛列車也 Ok!',
        featureFormations: '靈活的列車編組',
        featureNavigation: '平滑導覽',
        featureImportExport: '匯入與匯出，雲端與瀏覽器端自動儲存開發中',
        builtWithFooter:
            '基於 <ueToo>ue-too</ueToo> 打造 · <issues>回饋</issues>',
        motionOn: '動態效果：開',
        motionOff: '動態效果：關',
        enableAnimations: '啟用動畫',
        reduceAnimations: '減少動畫',
    },
} as const;

export default zhTW;

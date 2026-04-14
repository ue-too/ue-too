import { iconHandoff as iconHandoffStringsEn } from './icon-handoff-en';

const ja = {
    translation: {
        // Toolbar - Category Rail
        toolbarCategoryDrawing: '作図ツール',
        toolbarCategoryTrains: '列車管理',
        toolbarCategoryInfra: 'インフラ & 表示',
        toolbarCategoryScene: 'シーン & ファイル',
        toolbarCategoryDebug: 'デバッグ & 表示',

        // Toolbar - Layout
        startLayout: 'レイアウト開始',
        endLayout: 'レイアウト終了',
        deleteTrack: '線路を削除',
        endDeletion: '削除終了',
        duplicateTrackToSide: '線路を側方に複製',
        catenaryLayout: '架線配置',
        jointDirection: 'ポイント方向',

        // Toolbar - Mode Exit Chip
        exitMode: '終了',
        modeDrawingLayout: '線路を敷設中',
        modeDeletingTrack: '線路を削除中',
        modePlacingTrain: '列車を配置中',
        modePlacingStation: '駅を配置中',
        modeDuplicatingTrack: '線路を複製中',
        modeCatenaryLayout: '架線を配置中',
        modeSingleSpinePlatform: '片側ホームを配置中',
        modeDualSpinePlatform: '両側ホームを配置中',
        modePlacingBuilding: '建物を配置中',
        modeDeletingBuilding: '建物を削除中',
        modeJointDirection: 'ポイント方向',

        // Toolbar - Train
        placeTrain: '列車を配置',
        endPlacement: '配置終了',
        trainList: '列車一覧',
        closeTrainList: '列車一覧を閉じる',
        openDepot: '車庫を開く',
        closeDepot: '車庫を閉じる',
        editFormations: '編成を編集',
        closeFormations: '編成を閉じる',

        // Toolbar - Building
        placeBuilding: '建物を配置',
        deleteBuilding: '建物を削除',

        // Toolbar - Station
        placeStation: '駅を配置',
        endStationPlacement: '駅の配置を終了',
        openStationList: '駅一覧を開く',
        closeStationList: '駅一覧を閉じる',

        // Toolbar - Visualization
        showElevationGradient: '標高グラデーションを表示',
        hideElevationGradient: '標高グラデーションを非表示',
        showPreviewCurveArcs: 'プレビュー曲線弧を表示',
        hidePreviewCurveArcs: 'プレビュー曲線弧を非表示',
        elevationGradientLabel: '標高グラデーション',
        curveArcsLabel: '曲線弧',
        mapLabel: '地図',
        importExport: 'インポート / エクスポート',
        showMap: '地図を表示',
        hideMap: '地図を非表示',
        openDebug: 'デバッグを開く',
        closeDebug: 'デバッグを閉じる',
        sunAngle: '太陽角度',
        terrainFill: '地形',
        terrainOpacity: '地形の透明度',
        whiteOcclusion: '白色オクルージョン',
        elevation: '標高',

        // Export/Import
        exportTracksStations: '線路 + 駅をエクスポート',
        importTracksStations: '線路 + 駅をインポート',
        exportTrains: '列車をエクスポート（車両・編成・位置）',
        importTrains: '列車をインポート',
        exportAll: 'すべてエクスポート（線路 + 列車 + 駅 + 時刻表）',
        importAll: 'すべてインポート（線路 + 列車 + 駅 + 時刻表）',
        importTerrain: '地形をインポート',
        invalidTerrainData: '無効な地形データ：{{error}}',
        importCarDefinitionFromEditor:
            '車両定義をインポート（列車エディターから）',
        importCarDefinitionFromLibrary:
            '車両定義をインポート（ライブラリから）',

        // Scene Management
        sceneNotFound: 'ストレージにシーンが見つかりません',
        sceneDataInvalid: 'シーンデータが無効です：{{error}}',
        sceneLoaded: '「{{name}}」を読み込みました',
        sceneRestoreFailed: 'シーンの復元に失敗しました',
        scenePickerTitle: '保存済みシーン',
        scenePickerDescription:
            'シーンを選択して続行するか、新しいシーンを作成してください。',
        newScene: '新しいシーン',
        saveScene: 'シーンを保存',
        savedScenes: '保存済みシーン',
        noSavedScenes: '保存済みのシーンはありません。',
        lastActive: '最後に使用',
        justNow: 'たった今',
        minutesAgo: '{{count}}分前',
        hoursAgo: '{{count}}時間前',
        daysAgo: '{{count}}日前',
        confirmDelete: '削除',
        autoSaveInterval: '自動保存間隔',
        autoSave1Min: '1分',
        autoSave3Min: '3分',
        autoSave5Min: '5分',
        autoSave10Min: '10分',
        autoSaveToast: '「{{name}}」を自動保存しました',

        // Track-aligned platform hints
        hintPickStart: '線路をクリックして始点を設定',
        hintPickEnd: '線路に沿ってクリックして終点を設定',
        hintDrawOuter: 'クリックしてホーム端を描画 — 始点アンカー付近で閉じる',
        hintDualPickSpineAStart: '線路をクリックしてスパインAの始点を設定',
        hintDualPickSpineAEnd: '線路に沿ってクリックしてスパインAの終点を設定',
        hintDualPickSpineBStart:
            '反対側の線路をクリックしてスパインBの始点を設定',
        hintDualPickSpineBEnd: '線路に沿ってクリックしてスパインBの終点を設定',
        hintDualDrawCap1:
            'クリックして最初の端部キャップを描画 — スナップリング付近で閉じる',
        hintDualDrawCap2:
            'クリックして2番目の端部キャップを描画 — スナップリング付近で閉じる',
        hintPlatformCreated: 'ホームが作成されました',

        // Validation errors
        invalidTrackData: '無効な線路データ：{{error}}',
        invalidTrainData: '無効な列車データ：{{error}}',
        invalidSceneData: '無効なシーンデータ：{{error}}',
        invalidCarDefinition: '無効な車両定義：{{error}}',

        // Train Panel
        trains: '列車',
        placedTrains: '配置済みの列車',
        car_one: '{{count}} 両',
        car_other: '{{count}} 両',
        controls: '操作',
        throttleP5: '動力 P5',
        neutral: 'ニュートラル',
        switchDirection: '方向切替',
        removeSelectedTrain: '選択した列車を削除',
        focusOnSelectedTrain: '選択した列車にフォーカス',
        followSelectedTrain: '選択した列車を追跡',
        stopFollowing: '追跡を停止',

        // Depot Panel
        depot: '車庫',
        noCarsInStock: '車庫に車両がありません',
        bogieCount: '{{count}} 台車',
        templates: 'テンプレート',
        carType: 'タイプ',
        carType_locomotive: '機関車',
        carType_coach: '客車',
        carType_motor: '電動車',
        carType_trailer: '付随車',
        carType_freight: '貨車',
        carType_cab_car: '制御車',

        // Station List Panel
        stations: '駅',
        createEmptyStation: '空の駅を作成',
        noStations: '駅がありません',
        platform_one: '{{count}} ホーム',
        platform_other: '{{count}} ホーム',
        donePickingPlatforms: 'ホーム選択完了',
        pickPlatformsToAdd: '追加するホームを選択',
        panToStation: '駅に移動',
        deleteStation: '駅を削除',
        addSingleSpinePlatform: '片側ホームを追加',
        addDualSpinePlatform: '両側ホームを追加',
        trackAlignedPlatform_one: '{{count}}個の線路ホーム',
        trackAlignedPlatform_other: '{{count}}個の線路ホーム',
        nearbyPlatforms: '近くのホーム',
        cancel: 'キャンセル',
        noNearbyPlatforms: '他の駅の近くにホームがありません',
        platformTrackInfo: 'ホーム {{platformId}} — 線路 {{trackId}}',
        fromStationDistance: '{{name}} から · {{distance}}m',
        stationFallback: '駅 {{id}}',

        // Formation Selector
        formation: '編成',
        defaultFormation: 'デフォルト（4 両）',

        // Track Style Selector
        trackStyle: '線路スタイル',
        ballasted: 'バラスト道床',
        slabElevated: 'スラブ（高架）',
        electrified: '電化',
        bed: '路盤',
        bedWidth: '路盤幅',
        snapBuffer: 'スナップ距離',
        trackGauge: '軌間',
        customGauge: 'カスタム',
        gaugeLabels: '軌間ラベル',

        // Building Options Panel
        building: '建物',
        small: '小',
        medium: '中',
        large: '大',
        lShape: 'L 型',
        ground: '地上',
        above1: '地上 1',
        above2: '地上 2',
        above3: '地上 3',
        height: '高さ',
        level: '階',

        // Debug Panel
        debug: 'デバッグ',
        jointNumbers: '接続番号',
        segmentIds: 'セグメント ID',
        formationIds: '編成 ID',
        stationStops: '停車駅',
        stationLocations: '駅の位置',
        showBogies: '台車',
        terrainXray: '地形透視',
        fpsStats: 'FPS 統計',

        // Train Editor
        editBogies: '台車を編集',
        endEdit: '編集終了',
        addBogie: '台車を追加',
        endAdd: '追加終了',
        importImage: '画像をインポート',
        editImage: '画像を編集',
        endImageEdit: '画像編集を終了',
        exportCarDefinition: '車両定義をエクスポート',
        importCarDefinition: '車両定義をインポート',
        saveToLibrary: 'ライブラリに保存',
        loadFromLibrary: 'ライブラリから読み込み',
        save: '保存',
        carDefinitionLibraryTitle: '車両定義ライブラリ',
        carDefinitionLibraryDescription: '読み込む車両定義を選択してください。',
        noSavedCarDefinitions: '保存済みの車両定義はありません。',
        carDefinitionNamePlaceholder: '車両名',
        saveCarDefinitionTitle: '車両定義を保存',
        saveCarDefinitionDescription:
            'ライブラリに保存するための名前を入力してください。',
        saveCarDefinitionUpdateTitle: '車両定義を更新',
        saveCarDefinitionUpdateDescription:
            '既存のエントリを更新するか、名前を変更します。',
        untitledCar: '名称未設定の車両 {{count}}',
        needAtLeast2Bogies: 'エクスポートには台車が2つ以上必要です。',
        failedToParseJson: 'JSON の解析に失敗：{{error}}',
        invalidFileMissingBogieOffsets:
            '無効なファイル：bogieOffsets がありません。',

        // Formation Editor
        formations: '編成',
        onTrack: '線路上',
        inDepot: '車庫内',
        noFormationsInDepot: '車庫に編成がありません。',
        clickPlusToCreate: '+ を押して作成してください。',
        addCarsToDepotFirst: '先に車庫に車両を追加してください。',
        trainLabel: '列車 {{number}}',
        couplable: '連結可能',
        couple: '連結',
        coupleWith: '列車{{number}}と連結',
        couplingDepthExceeded:
            '連結不可：編成の入れ子が深すぎます。先にどちらかの編成を整理してください。',
        proximityLines: '連結近接表示',
        nested: 'ネスト',
        containsNestedFormations: 'ネストされた編成を含む',
        nestedFormation: 'ネストされた編成',
        composition: '構成',
        addFromStock: '車庫から追加',

        // Landing Page
        nextStop: '次は',
        landingTagline1: 'ブラウザで動く2D俯瞰鉄道シミュレーター。',
        landingTagline2: '線路、駅、列車、そしてもっと。',
        openSimulator: 'シミュレーターを開く',
        openTutorial: 'チュートリアル（作成中）',
        openCarEditor: '車両エディターを開く',
        build: '建設',
        simulate: 'シミュレート',
        featureTrackDrawing: 'ベジエ曲線による線路敷設',
        featureTerrain: '地形とハイトマップ',
        featureStations: '駅と建物',
        featureTrainSim: '列車シミュレーション',
        featureFormations: '柔軟な列車編成',
        featureNavigation: 'スムーズなナビゲーション',
        featureImportExport: 'インポートとエクスポート',
        builtWithFooter:
            '<ueToo>ue-too</ueToo> をベースに構築 · <issues>フィードバック</issues>',
        cjkFontCreditFooter:
            'CJK ピクセルフォント: <cubic11>Cubic 11</cubic11> by ACh-K',
        motionOn: 'モーション：オン',
        motionOff: 'モーション：オフ',
        enableAnimations: 'アニメーションを有効にする',
        reduceAnimations: 'アニメーションを減らす',

        // Analytics Notice
        analyticsNotice:
            'このサイトでは体験向上のため基本的なイベントトラッキングを使用しています。個人データは収集されません。',

        // 404 Page
        notFoundMessage: 'この線路はどこにも繋がっていません。',
        backToHome: 'ホーム',

        // Icon handoff (/icon-handoff) — English until localized
        iconHandoff: iconHandoffStringsEn,
    },
} as const;

export default ja;

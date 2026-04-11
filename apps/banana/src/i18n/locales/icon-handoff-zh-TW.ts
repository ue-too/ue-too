/**
 * Traditional Chinese (zh-TW) strings for the /icon-handoff page.
 */
export const iconHandoff = {
    title: '圖示交付（設計用）',
    intro:
        '{{appName}} 應用程式的視覺化圖示清單：每一列顯示目前實作的圖示、設計師交付用 SVG 的預留位置，以及用途說明。Lucide 參考：',
    lucideLinkLabel: 'lucide.dev',
    introClosing: '。',
    backToLanding: '← 返回首頁',
    conventionTitle: '設計師檔案約定',
    conventionP1:
        '每個圖示請將 SVG 放在 public/designer-icons/<slug>/<slug>.svg。slug 須與資料夾名稱與檔名（不含 .svg）一致（見各列第二行）。',
    conventionP2:
        'React 匯出名稱會經由 src/pages/icon-handoff/designer-slug.ts 的 iconExportToDesignerFolder() 轉成 slug（例如 ExportSceneIcon → export-scene-icon）。',
    conventionP3:
        '執行 bun run generate:designer-icons 可建立缺少的佔位檔；不會覆寫既有的 SVG。',
    conventionP4:
        '若要全部還原成預設佔位圖，請使用：DESIGNER_ICONS_FORCE=1 bun run generate:designer-icons。',
    tableName: '名稱',
    tableCurrent: '目前',
    tableDesigner: '設計稿',
    tableUsedFor: '用途',
    inlineSvgNote: '原始碼內嵌 SVG',
    footerIntro: '文字版清單亦見於',
    footerFile: 'ICONS.md',
    footerOutro: '（應用程式根目錄）。',
    sectionCustomTitle: '自訂應用程式圖示',
    sectionCustomSubtitle:
        '位於 src/assets/icons/ 的第一方 React SVG 元件，為客製美術的主要對象。',
    sectionLucideTitle: 'Lucide 圖示',
    sectionLucideSubtitle:
        '經由 src/assets/icons/lucide.ts 從 lucide-react 轉匯。此處的設計師 SVG 供對照或未來替換素材使用。',
    sectionOtherTitle: '其他圖形標記',
    sectionOtherSubtitle:
        '非自 @/assets/icons 匯入；納入清單以便以相同資料夾慣例追蹤美術檔。',
    desc: {
        BulldozerIcon:
            '切換軌道佈局刪除模式（移除軌道段）。在佈局編輯進行中顯示。原始碼註：改編自 Tabler Icons。',
        ExportTrackIcon: '匯出軌道與車站為 JSON（匯出子選單）。',
        ImportTrackIcon: '從 JSON 匯入軌道與車站。',
        ExportTrainIcon: '匯出列車（編組／列車資料）為 JSON。',
        ImportTrainIcon: '從 JSON 匯入列車。',
        ExportSceneIcon: '匯出完整場景（一併打包）。',
        ImportSceneIcon: '從 JSON 匯入完整場景。',
        Activity: '除錯面板：切換 FPS／效能統計疊加層。',
        ArrowDown: '編組編輯器：將組成段向下調整順序（與下一項交換）。',
        ArrowLeftRight:
            '列車面板：反轉所選列車行進方向。編組編輯器：反轉編組內車輛順序（「反轉編組」）。',
        ArrowUp: '編組編輯器：將組成段向上調整順序（與上一項交換）。',
        Bug: '主工具列：開啟／關閉除錯面板。',
        Building2:
            '保留：主工具列「放置建築」按鈕目前在程式中註解掉；圖示保留供日後啟用。',
        Check:
            '車站清單：確認已完成替車站挑選月台（結束指定月台模式）。',
        CheckIcon:
            '下拉選單：在可選項列中顯示目前選中項目（shadcn 慣例）。',
        Clock:
            '主工具列：開啟／關閉時刻表面板（班次排程、路線、自動駕駛指派）。',
        ChevronDown:
            '編組編輯器：編組卡片摺疊狀態的箭頭；將所選庫存車輛／車庫編組接到編組末端。',
        ChevronLeft: '模擬時間控制：降低時間速度（在速度預設間往下調）。',
        ChevronRight: '模擬時間控制：提高時間速度（在速度預設間往上調）。',
        ChevronRightIcon: '下拉選單：表示該列有巢狀子選單。',
        ChevronUp:
            '編組編輯器：編組卡片展開狀態的箭頭；將所選庫存車輛／車庫編組接到編組前端。',
        CircleCheckIcon: 'Toast（Sonner）：成功通知圖示。',
        CircleIcon: '下拉選單：單選項目的圓形未選中標記。',
        Crosshair:
            '列車面板：開始／停止跟隨所選列車的攝影機。車站清單：平移地圖對準車站。',
        Download:
            '匯出子選單：開啟匯入／匯出飛出選單的父按鈕。地形編輯器：匯出地形 JSON。列車編輯器：匯出車輛定義 JSON（需有效轉向架）。',
        Eraser: '地形編輯器：橡皮擦筆刷模式（清除已繪製的水體）。',
        Eye: '除錯面板：切換地形 X 光／透視除錯顯示。',
        Focus: '列車面板：將攝影機聚焦所選列車（縮放／平移動畫）。',
        Gauge:
            '匯出子選單：從列車編輯器匯入車輛定義（儀表隱喻）。',
        Github: '首頁頁尾：連結至 GitHub 上的 {{appName}} 原始碼。',
        GripHorizontal: '列車編輯器：切換編輯車體圖片模式（縮放／移動精靈圖）。',
        Hash: '除錯面板：切換軌道接點編號疊加層。',
        Image: '列車編輯器：匯入點陣圖至車體。',
        Info: '地圖版權列：展開／收合地圖署名（OpenStreetMap／Protomaps）。',
        InfoIcon: 'Toast：一般資訊通知圖示。',
        Landmark:
            '主工具列：開啟／關閉車站清單面板。除錯面板：切換車站位置標記。',
        Layers:
            '主工具列：切換高度漸層疊加層。編組編輯器：車庫內編組區塊標題圖示。地形編輯器：切換畫布底下的地圖疊加層。',
        Link2:
            '編組編輯器：可聯掛列車的標記與按鈕；除錯面板：聯掛距離輔助線疊加層。',
        List: '主工具列：開啟／關閉列車清單面板。',
        ListOrdered:
            '主工具列：開啟／關閉編組編輯器。除錯面板：切換軌道段 ID 顯示。',
        Loader2Icon: 'Toast：載入中（旋轉圖示）。',
        Map: '主工具列（啟用時）：顯示／隱藏畫布底下的底圖。',
        MapPin: '除錯面板：切換車站停靠位置疊加層。',
        Merge:
            '編組編輯器：將巢狀編組扁平合併為單一編組（當存在巢狀群組時）。',
        Mountain:
            '地形控制：地形填色顯示開關。匯出子選單：匯入地形資料。',
        MousePointer2: '列車編輯器：編輯轉向架模式（放置／調整輪位）。',
        OctagonXIcon: 'Toast：錯誤通知圖示。',
        Package: '地形編輯器：將地形匯出為場景包，供主程式 {{appName}} 使用。',
        Pause: '模擬時間控制：暫停世界時鐘（執行中時顯示）。',
        Pencil:
            '車庫：重新命名庫存車輛。編組編輯器：重新命名編組（觸發行內編輯）。',
        Play: '模擬時間控制：繼續世界時鐘（暫停時顯示）。',
        Plus:
            '車庫：新增庫存車輛；從範本複製到庫存。編組編輯器：建立新編組。列車編輯器：新增轉向架模式。',
        Scissors:
            '編組編輯器：在車輛邊界處解聯列車（剪刀控制列）。',
        Settings2: '車站清單：進入挑選月台模式，為車站指定月台。',
        Snowflake: '地形控制：白色遮罩／雪地風格地形明暗切換。',
        Spline: '主工具列：鋪軌時顯示／隱藏預覽曲線弧。',
        Sun: '光照小工具：調整日照角度（0–360°）。',
        TrainFront:
            '主工具列：列車放置模式。編組選擇列：「編組」下拉旁的裝飾圖示。編組編輯器：線上編組區塊標題。除錯面板：切換編組 ID 疊加層。',
        TrainTrack: '主工具列：進入／結束軌道佈局編輯模式。',
        Trash2:
            '移除所選列車；刪除車站；刪除編組或組成列；從車庫移除車輛。各面板通用的主要刪除圖示。',
        TriangleAlertIcon: 'Toast：警告通知圖示。',
        Upload: '地形編輯器：匯入地形 JSON。列車編輯器：匯入車輛定義 JSON。',
        Warehouse:
            '主工具列：車庫面板（庫存車輛）。亦用於車站放置模式（車廠／調車場隱喻）。',
        X: '關閉可拖曳面板。車站清單：取消挑選月台模式。',
        favicon:
            '瀏覽器分頁圖示（public/favicon.svg）。品牌更新時可替換。',
        languageChevron:
            '語言切換器內，緊鄰語系標籤的小型內嵌 SVG（開啟語言選單）。非 Lucide 轉匯列的一部分。',
    },
    assetLabel: {
        favicon: '瀏覽器網站圖示',
        languageChevron: '語言切換箭頭',
    },
} as const;

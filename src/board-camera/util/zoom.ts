
export type ZoomLevelLimits = {min?: number, max?: number};

export function clampZoomLevel(zoomLevel: number, zoomLevelLimits: ZoomLevelLimits): number{
    if(zoomLevelWithinLimits(zoomLevel, zoomLevelLimits)){
        return zoomLevel;
    }
    if(zoomLevelLimits.max){
        zoomLevel = Math.min(zoomLevelLimits.max, zoomLevel);
    }
    if(zoomLevelLimits.min){
        zoomLevel = Math.max(zoomLevelLimits.min, zoomLevel);
    }
    return zoomLevel;
}

export function zoomLevelWithinLimits(zoomLevel: number, zoomLevelLimits: ZoomLevelLimits): boolean{
    if(zoomLevel <= 0 || (zoomLevelLimits !== undefined && 
    ((zoomLevelLimits.max !== undefined && zoomLevelLimits.max < zoomLevel) || 
        (zoomLevelLimits.min !== undefined && zoomLevelLimits.min > zoomLevel)
    ))){
        return false;
    }
    return true;
}

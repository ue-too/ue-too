/**
 * @description The limits of the zoom level.
 * 
 * @category Camera
 */
export type ZoomLevelLimits = {min?: number, max?: number};

/**
 * @description Checks if the zoom level limits are valid.
 */
export function isValidZoomLevelLimits(zoomLevelLimits: ZoomLevelLimits | undefined): boolean{
    if(zoomLevelLimits === undefined){
        return true;
    }
    if(zoomLevelLimits.min !== undefined && zoomLevelLimits.max !== undefined && zoomLevelLimits.min > zoomLevelLimits.max){
        return false;
    }
    return true;
}

/**
 * @description Clamps the zoom level within the limits.
 * 
 * @category Camera
 */
export function clampZoomLevel(zoomLevel: number, zoomLevelLimits?: ZoomLevelLimits): number{
    if(zoomLevelWithinLimits(zoomLevel, zoomLevelLimits) || zoomLevelLimits === undefined){
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

/**
 * @description Checks if the zoom level is within the limits.
 * 
 * @category Camera
 */
export function zoomLevelWithinLimits(zoomLevel: number, zoomLevelLimits?: ZoomLevelLimits): boolean{
    if(zoomLevelLimits === undefined){
        return true;
    }
    if(zoomLevel <= 0 || (zoomLevelLimits !== undefined && 
    ((zoomLevelLimits.max !== undefined && zoomLevelLimits.max < zoomLevel) || 
        (zoomLevelLimits.min !== undefined && zoomLevelLimits.min > zoomLevel)
    ))){
        return false;
    }
    return true;
}

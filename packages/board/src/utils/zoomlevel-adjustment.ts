import { Boundaries, translationHeightOf, translationWidthOf } from "../camera/utils/position";
import { ZoomLevelLimits } from "../camera/utils/zoom";

/**
 * @description Calculates the minimum zoom level based on the dimensions of the boundaries.
 * Used when the canvas on the html is resized.
 * 
 * @category Camera
 */
export function minZoomLevelBaseOnDimensions(boundaries: Boundaries | undefined, canvasWidth: number, canvasHeight: number, cameraRotation: number): number | undefined{
    const width = translationWidthOf(boundaries);
    const height = translationHeightOf(boundaries);
    if(width == undefined || height == undefined){
        return undefined;
    }
    // console.log(canvasHeight, canvasWidth);
    const widthWidthProjection = Math.abs(width * Math.cos(cameraRotation));
    const heightWidthProjection = Math.abs(height * Math.cos(cameraRotation));
    const widthHeightProjection = Math.abs(width * Math.sin(cameraRotation));
    const heightHeightProjection = Math.abs(height * Math.sin(cameraRotation));
    let minZoomLevelWidthWidth = canvasWidth / widthWidthProjection;
    let minZoomLevelHeightWidth = canvasWidth / heightWidthProjection;
    let minZoomLevelWidthHeight = canvasHeight / widthHeightProjection;
    let minZoomLevelHeightHeight = canvasHeight / heightHeightProjection;
    if(minZoomLevelWidthWidth == Infinity){
        minZoomLevelWidthWidth = 0;
    }
    if(minZoomLevelHeightWidth == Infinity){
        minZoomLevelHeightWidth = 0;
    }
    if(minZoomLevelWidthHeight == Infinity){
        minZoomLevelWidthHeight = 0;
    }
    if(minZoomLevelHeightHeight == Infinity){
        minZoomLevelHeightHeight = 0;
    }

    // console.log(minZoomLevelWidthWidth, minZoomLevelHeightWidth, minZoomLevelWidthHeight, minZoomLevelHeightHeight);

    const minZoomLevelHeight = canvasHeight / height;
    const minZoomLevelWidth = canvasWidth / width;
    const minZoomLevel = Math.max(minZoomLevelHeight, minZoomLevelWidth, minZoomLevelWidthWidth, minZoomLevelHeightWidth, minZoomLevelWidthHeight, minZoomLevelHeightHeight);
    return minZoomLevel;
}

/**
 * @description Determines if the zoom level boundaries should be updated when the canvas is resized.
 * Zoom level boundaries adjustment only tightens the zoom level boundaries; it does not relax them.
 * 
 * @category Camera
 */
export function zoomLevelBoundariesShouldUpdate(zoomLevelBoundaries: ZoomLevelLimits | undefined, targetMinZoomLevel: number | undefined): boolean{
    if(targetMinZoomLevel == undefined){
        return false;
    }
    if(zoomLevelBoundaries == undefined){
        return true;
    }
    if(targetMinZoomLevel == Infinity){
        return false;
    }
    if(zoomLevelBoundaries !== undefined && (zoomLevelBoundaries.min == undefined || targetMinZoomLevel > zoomLevelBoundaries.min)){
        return true;
    }
    return false;
}

/**
 * @description Calculates the minimum zoom level based on the width of the boundaries.
 * Used when the canvas on the html is resized.
 * @category Camera
 */
export function minZoomLevelBaseOnWidth(boundaries: Boundaries | undefined, canvasWidth: number, canvasHeight: number, cameraRotation: number): number | undefined{
    const width = translationWidthOf(boundaries);
    if(width == undefined){
        return undefined;
    }
    const widthWidthProjection = Math.abs(width * Math.cos(cameraRotation));
    const widthHeightProjection = Math.abs(width * Math.sin(cameraRotation));
    const minZoomLevelWidthWidth = canvasWidth / widthWidthProjection;
    const minZoomLevelWidthHeight = canvasHeight / widthHeightProjection;
    if(minZoomLevelWidthWidth == Infinity){
        return minZoomLevelWidthHeight;
    }
    const minZoomLevel = Math.max(canvasWidth / widthWidthProjection, canvasHeight / widthHeightProjection);
    return minZoomLevel;
}

/**
 * @description Calculates the minimum zoom level based on the height of the boundaries.
 * Used when the canvas on the html is resized.
 * @category Camera
 */
export function minZoomLevelBaseOnHeight(boundaries: Boundaries | undefined, canvasWidth: number, canvasHeight: number, cameraRotation: number): number | undefined{
    const height = translationHeightOf(boundaries);
    if(height == undefined){
        return undefined;
    }
    const heightWidthProjection = Math.abs(height * Math.cos(cameraRotation));
    const heightHeightProjection = Math.abs(height * Math.sin(cameraRotation));
    const minZoomLevelHeightWidth = canvasWidth / heightWidthProjection;
    const minZoomLevelHeightHeight = canvasHeight / heightHeightProjection;
    if(minZoomLevelHeightHeight == Infinity){
        return minZoomLevelHeightWidth;
    }
    const minZoomLevel = Math.max(minZoomLevelHeightWidth, minZoomLevelHeightHeight);
    return minZoomLevel;
}

import { Boundaries, translationHeightOf, translationWidthOf } from "src/board-camera/utils/position";
import { ZoomLevelLimits } from "src/board-camera/utils/zoom";

export function minZoomLevelBaseOnDimensions(boundaries: Boundaries | undefined, canvasWidth: number, canvasHeight: number, cameraRotation: number): number | undefined{
    const width = translationWidthOf(boundaries);
    const height = translationHeightOf(boundaries);
    if(width == undefined || height == undefined){
        return undefined;
    }
    const widthWidthProjection = Math.abs(width * Math.cos(cameraRotation));
    const heightWidthProjection = Math.abs(height * Math.cos(cameraRotation));
    const widthHeightProjection = Math.abs(width * Math.sin(cameraRotation));
    const heightHeightProjection = Math.abs(height * Math.sin(cameraRotation));
    const minZoomLevelWidthWidth = canvasWidth / widthWidthProjection;
    const minZoomLevelHeightWidth = canvasWidth / heightWidthProjection;
    const minZoomLevelWidthHeight = canvasHeight / widthHeightProjection;
    const minZoomLevelHeightHeight = canvasHeight / heightHeightProjection;

    const minZoomLevelHeight = canvasHeight / height;
    const minZoomLevelWidth = canvasWidth / width;
    const minZoomLevel = Math.max(minZoomLevelHeight, minZoomLevelWidth, minZoomLevelWidthWidth, minZoomLevelHeightWidth, minZoomLevelWidthHeight, minZoomLevelHeightHeight);
    return minZoomLevel;
}

export function zoomLevelBoundariesShouldUpdate(zoomLevelBoundaries: ZoomLevelLimits | undefined, targetMinZoomLevel: number | undefined): boolean{
    if(targetMinZoomLevel == undefined){
        return false;
    }
    if(zoomLevelBoundaries !== undefined && (zoomLevelBoundaries.min == undefined || targetMinZoomLevel > zoomLevelBoundaries.min)){
        return true;
    }
    return false;
}

export function minZoomLevelBaseOnWidth(boundaries: Boundaries | undefined, canvasWidth: number, canvasHeight: number, cameraRotation: number): number | undefined{
    const width = translationWidthOf(boundaries);
    if(width == undefined){
        return undefined;
    }
    const widthWidthProjection = Math.abs(width * Math.cos(cameraRotation));
    const widthHeightProjection = Math.abs(width * Math.sin(cameraRotation));
    const minZoomLevel = Math.max(canvasWidth / widthWidthProjection, canvasHeight / widthHeightProjection);
    return minZoomLevel;
}

export function minZoomLevelBaseOnHeight(boundaries: Boundaries | undefined, canvasWidth: number, canvasHeight: number, cameraRotation: number): number | undefined{
    const height = translationHeightOf(boundaries);
    if(height == undefined){
        return undefined;
    }
    const heightWidthProjection = Math.abs(height * Math.cos(cameraRotation));
    const heightHeightProjection = Math.abs(height * Math.sin(cameraRotation));
    const minZoomLevelHeightWidth = canvasWidth / heightWidthProjection;
    const minZoomLevelHeightHeight = canvasHeight / heightHeightProjection;
    const minZoomLevel = Math.max(minZoomLevelHeightWidth, minZoomLevelHeightHeight);
    return minZoomLevel;
}

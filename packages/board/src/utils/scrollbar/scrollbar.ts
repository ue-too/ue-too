import { BoardCamera, translationHeightOf, translationWidthOf } from "../../camera";

export const getScollBarDimension = (boardCamera: BoardCamera): {horizontal: number, vertical: number} => {
    if(boardCamera.rotation != 0){
        return {horizontal: 0, vertical: 0};
    }

    const boundaries = boardCamera.boundaries;
    if(boundaries == undefined){
        return {horizontal: 0, vertical: 0};
    }
    const width = translationWidthOf(boundaries);
    const height = translationHeightOf(boundaries);

    let scrollWidth = 0;
    let scrollHeight = 0;
    if(width != undefined) {
        scrollWidth = boardCamera.viewPortWidth * boardCamera.zoomLevel / width;
    }
    if(height != undefined) {
        scrollHeight = boardCamera.viewPortHeight * boardCamera.zoomLevel / height;
    }
    return {horizontal: scrollWidth, vertical: scrollHeight};
}

import {
    BoardCamera,
    boundariesFullyDefined,
    translationHeightOf,
    translationWidthOf,
} from '../../camera';

export const getScrollBarDimension = (
    boardCamera: BoardCamera
): { horizontal: number; vertical: number } => {
    if (boardCamera.rotation != 0) {
        return { horizontal: 0, vertical: 0 };
    }

    const boundaries = boardCamera.boundaries;
    if (boundaries == undefined) {
        return { horizontal: 0, vertical: 0 };
    }
    const width = translationWidthOf(boundaries);
    const height = translationHeightOf(boundaries);

    let scrollWidth = 0;
    let scrollHeight = 0;
    if (width != undefined) {
        scrollWidth = boardCamera.viewPortWidth / boardCamera.zoomLevel / width;
    }
    if (height != undefined) {
        scrollHeight =
            boardCamera.viewPortHeight / boardCamera.zoomLevel / height;
    }
    return { horizontal: scrollWidth, vertical: scrollHeight };
};

/**
 * The returned position is relative to the boundaries. (0 to 1)
 * @param boardCamera
 * @returns {horizontal: number | undefined, vertical: number | undefined}
 */
export const getScrollBarPosition = (
    boardCamera: BoardCamera
): { horizontal: number | undefined; vertical: number | undefined } => {
    if (boardCamera.rotation != 0) {
        return { horizontal: undefined, vertical: undefined };
    }

    if (!boundariesFullyDefined(boardCamera.boundaries)) {
        return { horizontal: undefined, vertical: undefined };
    }

    let horizontalPosition = undefined;
    let verticalPosition = undefined;

    // TODO make it more flexible to handle cases where viewport center is not at the origin (0, 0)
    const topLeft = boardCamera.convertFromViewPort2WorldSpace({
        x: -boardCamera.viewPortWidth / 2,
        y: -boardCamera.viewPortHeight / 2,
    });
    const bottomRight = boardCamera.convertFromViewPort2WorldSpace({
        x: boardCamera.viewPortWidth / 2,
        y: boardCamera.viewPortHeight / 2,
    });

    const startHorizontalPosition = Math.min(topLeft.x, bottomRight.x);
    const startVerticalPosition = Math.min(topLeft.y, bottomRight.y);

    horizontalPosition =
        (startHorizontalPosition - boardCamera.boundaries.min.x) /
        (boardCamera.boundaries.max.x - boardCamera.boundaries.min.x);
    verticalPosition =
        (startVerticalPosition - boardCamera.boundaries.min.y) /
        (boardCamera.boundaries.max.y - boardCamera.boundaries.min.y);

    return { horizontal: horizontalPosition, vertical: verticalPosition };
};

export const getScrollBar = (
    camera: BoardCamera
): {
    horizontalLength: number | undefined;
    verticalLength: number | undefined;
    horizontal: number | undefined;
    vertical: number | undefined;
} => {
    const position = getScrollBarPosition(camera);
    const dimension = getScrollBarDimension(camera);

    const res = {
        horizontalLength: dimension.horizontal * camera.viewPortWidth,
        verticalLength: dimension.vertical * camera.viewPortHeight,
        horizontal:
            position.horizontal != undefined
                ? position.horizontal * camera.viewPortWidth
                : undefined,
        vertical:
            position.vertical != undefined
                ? position.vertical * camera.viewPortHeight
                : undefined,
    };

    return res;
};

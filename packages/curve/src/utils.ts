import { Point, PointCal } from '@ue-too/math';

//JavaScript implementation of winding number algorithm to determine whether a point is inside a polygon
//Based on C++ implementation of wn_PnPoly() published on http://geomalgorithms.com/a03-_inclusion.html
// Original is vlasky's implementation on https://gist.github.com/vlasky/d0d1d97af30af3191fc214beaf379acc
// TypeScript by gmac Greg MacWilliam https://gist.github.com/gmac

function isLeft(x: Point, y: Point, z: Point): number {
    return (y.x - x.x) * (z.y - x.y) - (z.x - x.x) * (y.y - x.y);
}
  
export function pointInPolygonWN(p: Point, points: Array<Point>): boolean {
    let wn = 0; // winding number

    points.forEach((a, i) => {
        const b = points[(i+1) % points.length];
        if (a.y <= p.y) {
        if (b.y > p.y && isLeft(a, b, p) > 0) {
            wn += 1;
        }
        } else if (b.y <= p.y && isLeft(a, b, p) < 0) {
        wn -= 1;
        }
    });

    return wn !== 0;
}

export function pointInPolygon(polygonVertices: Point[], interestedPoint: Point){
    let angleCheck = polygonVertices.map((point, index, array)=>{
        let endPoint: Point;
        if (index == polygonVertices.length - 1) {
            // last one need to wrap to the first point
            endPoint = array[0];
        }else {
            endPoint = array[index + 1];
        }
        let baseVector = PointCal.subVector(endPoint, point);
        let checkVector = PointCal.subVector(interestedPoint, point);
        return PointCal.angleFromA2B(baseVector, checkVector);
    });
    let outOfPolygon = angleCheck.filter((angle)=>{
        return angle > 0;
    }).length > 0;

    return !outOfPolygon;
}

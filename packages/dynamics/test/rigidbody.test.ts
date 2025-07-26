import { Polygon } from "../src/rigidbody";

describe("Polygon Rigidbody", ()=>{
    

    test("Initializing a polygon rigidbody", ()=>{
        const testPolygon = new Polygon({x: 0, y: 0}, [{x: 10, y: 10}, {x: -10, y: 10}, {x: -10, y: -10}, {x: 10, y: -10}]);
        
    })
});

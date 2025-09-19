import Board from "../components/Board";
import { useCallback, useState } from "react";
import { CompositeBCurve } from "@ue-too/curve";

export default function RaceTrackBuilder() {

    const [curves] = useState<CompositeBCurve[]>([]);
    const [fullScreen] = useState(false);
    const [width, setWidth] = useState(300);

    const animationCallback = useCallback((_timestamp: number, ctx: CanvasRenderingContext2D) => {
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        ctx.save();
        curves.forEach((curve) => {
            ctx.beginPath();
            const cps = curve.getControlPoints();
            for(let i = 0; i < cps.length - 1; i++){
                const cp = cps[i];
                const nextCp = cps[i + 1];
                const cpPosition = cp.getPosition();
                const nextCpPosition = nextCp.getPosition();
                const leftHandlePosition = cp.getLeftHandle().position;
                const rightHandlePosition = cp.getRightHandle().position;

                ctx.moveTo(cpPosition.x, cpPosition.y);
                ctx.bezierCurveTo(leftHandlePosition.x, leftHandlePosition.y, rightHandlePosition.x, rightHandlePosition.y, nextCpPosition.x, nextCpPosition.y);
            }
            ctx.stroke();
        });
        ctx.restore();
    }, [curves]);



    return (
        <>
            <Board  width={width} height={300} fullScreen={fullScreen} animationCallback={animationCallback}/>
            <button onClick={() => {
                setWidth((prev) => prev + 10);
            }}>Increase Width</button>
            <button onClick={() => {
                setWidth((prev) => prev - 10);
            }}>Decrease Width</button>
        </>
    );
}

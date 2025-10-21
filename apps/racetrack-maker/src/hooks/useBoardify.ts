import { Board as Boardify } from "@ue-too/board";
import { useEffect, useRef } from "react";

export function useBoardify(canvas: React.RefObject<HTMLCanvasElement>, fullScreen: boolean = false){

    const boardRef = useRef<Boardify | null>(null);

    if(boardRef.current == null){
        boardRef.current = new Boardify();
    }

    useEffect(() => {
        if(boardRef.current != null){
            boardRef.current.fullScreen = fullScreen;
        }
    }, [fullScreen]);

    useEffect(() => {
        if(canvas.current != null){
            boardRef.current?.attach(canvas.current);
        }
        return () => {
            boardRef.current?.tearDown();
        };
    }, []);

    return {
        board: boardRef.current,
        subscribe: (callback: () => void) => {
            if(boardRef.current == null){
                return () => {};
            }
            return boardRef.current.on("pan", (_event, _data)=>{
                callback();
            });
        }
    }
}
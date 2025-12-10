import { Board as Boardify } from "@ue-too/board";
import { useEffect, useRef } from "react";

export function useBoardify(fullScreen: boolean = false){

    const boardRef = useRef<Boardify>(new Boardify());

    useEffect(() => {
        boardRef.current.fullScreen = fullScreen;
    }, [fullScreen]);

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

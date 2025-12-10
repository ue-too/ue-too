import { Board as Boardify } from "@ue-too/board";
import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { CameraEventMap, CameraState } from "@ue-too/board";

type StateToEventKey<K extends keyof CameraState> = 
    K extends "position" ? "pan" : K extends "zoomLevel" ? "zoom" : "rotate";

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

export function useBoardifyNew(fullScreen: boolean = false){

    const board = useBoard();

    useEffect(() => {
        board.fullScreen = fullScreen;
    }, [fullScreen]);

    return board;
}

export function useBoardCameraState<K extends keyof CameraState>(state: K): CameraState[K] {
    const board = useBoard();
    const stateKey = (state === "position" ? "pan" : state === "zoomLevel" ? "zoom" : "rotate") as StateToEventKey<K>;
    return useSyncExternalStore(
        (cb) => board.camera.on(stateKey, cb),
        () => board.camera[state],
    );
}

const BoardContext = createContext<Boardify | null>(null);

export function BoardProvider({children}: {children: React.ReactNode}) {
    const board = useMemo(()=>new Boardify(), []);
    return <BoardContext.Provider value={board}>{children}</BoardContext.Provider>;
}

export function useBoard() {
    const board = useContext(BoardContext);
    if(board == null){
        throw new Error('Board Provider not found');
    }
    return board;
}

export function useBoardCamera() {
    const board = useBoard();
    return board.camera;
}



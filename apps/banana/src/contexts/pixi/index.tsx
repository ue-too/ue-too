import { createContext, useContext, useState } from 'react';
import { PixiAppComponents } from '@/utils/pixi';

type PixiCanvasContextType = {
  setResult: (result: PixiCanvasResult) => void;
  result: PixiCanvasResult;
}

type PixiCanvasUninitializedResult = {
  initialized: false;
}

type PixiCanvasInitializeFailedResult = {
  initialized: true;
  success: false;
}

type PixiCanvasInitializeSuccessResult = {
  initialized: true;
  success: true;
  components: PixiAppComponents;
}

export type PixiCanvasResult = PixiCanvasUninitializedResult | PixiCanvasInitializeFailedResult | PixiCanvasInitializeSuccessResult;

const PixiCanvasContext = createContext<PixiCanvasContextType>({setResult: () => {}, result: {initialized: false}});

export const usePixiCanvas = () => {
  const context = useContext(PixiCanvasContext);
  if(context == null){
    throw new Error('PixiCanvasContext not found, make sure you are using PixiCanvasProvider to wrap your component');
  }
  return context;
};

export const PixiCanvasProvider = ({ children }: { children: React.ReactNode }) => {
  const [result, setResult] = useState<PixiCanvasResult>({initialized: false});
  return (
    <PixiCanvasContext.Provider value={{setResult, result}}>
      {children}
    </PixiCanvasContext.Provider>
  );
};

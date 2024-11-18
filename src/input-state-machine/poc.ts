// Types and interfaces
export type StateName = 'idle' | 'readyToPan' | 'regularDrag' | 'panning';
export type EventName = 'SPACE_DOWN' | 'SPACE_UP' | 'POINTER_DOWN' | 'POINTER_UP';

export interface StateTransitions {
  [key: string]: EventName[];
}

export interface Context {
  startX: number;
  startY: number;
}

export interface StateConfig {
  [key: string]: {
    [key in EventName]?: StateName;
  };
}

export interface PanEventDetail {
  deltaX: number;
  deltaY: number;
}

export interface DragEventDetail {
  x: number;
  y: number;
}

export interface StateChangeEventDetail {
  prevState: StateName;
  newState: StateName;
}

export type StateChangeListener = (
  prevState: StateName,
  newState: StateName,
  context: Context
) => void;

export class PanStateMachine {
  private states: StateConfig;
  private currentState: StateName;
  private context: Context;
  private listeners: Set<StateChangeListener>;

  constructor() {
    this.states = {
      idle: {
        SPACE_DOWN: 'readyToPan',
        POINTER_DOWN: 'regularDrag'
      },
      readyToPan: {
        SPACE_UP: 'idle',
        POINTER_DOWN: 'panning'
      },
      regularDrag: {
        POINTER_UP: 'idle'
      },
      panning: {
        POINTER_UP: 'readyToPan',
        SPACE_UP: 'regularDrag'
      }
    };

    this.currentState = 'idle';
    this.context = {
      startX: 0,
      startY: 0
    };
    
    this.listeners = new Set();
  }

  transition(event: EventName): boolean {
    const nextState = this.states[this.currentState][event];
    if (nextState) {
      const prevState = this.currentState;
      this.currentState = nextState;
      this.notifyListeners(prevState, nextState);
      return true;
    }
    return false;
  }

  addListener(callback: StateChangeListener): void {
    this.listeners.add(callback);
  }

  removeListener(callback: StateChangeListener): void {
    this.listeners.delete(callback);
  }

  private notifyListeners(prevState: StateName, newState: StateName): void {
    this.listeners.forEach(callback => {
      callback(prevState, newState, this.context);
    });
  }

  getState(): StateName {
    return this.currentState;
  }

  updateContext(updates: Partial<Context>): void {
    this.context = { ...this.context, ...updates };
  }

  getContext(): Context {
    return { ...this.context };
  }
}

export class PanController {
  private element: HTMLElement;
  private stateMachine: PanStateMachine;
  private boundHandleStateChange: StateChangeListener;

  constructor(element: HTMLElement) {
    this.element = element;
    this.stateMachine = new PanStateMachine();
    
    this.boundHandleStateChange = this.handleStateChange.bind(this);
    this.stateMachine.addListener(this.boundHandleStateChange);
    
    this.setupEventListeners();
  }

  private handleStateChange(
    prevState: StateName,
    newState: StateName,
    context: Context
  ): void {
    // Update element classes
    this.element.classList.remove(prevState);
    this.element.classList.add(newState);

    // Handle state entry actions
    if (newState === 'panning' && prevState !== 'panning') {
      this.handlePanStart(context);
    }
    
    // Handle state exit actions
    if (prevState === 'panning' && newState !== 'panning') {
      this.handlePanEnd();
    }

    this.emit<StateChangeEventDetail>('stateChange', {
      prevState,
      newState
    });
  }

  private handlePanStart(context: Context): void {
    this.emit<DragEventDetail>('panStart', {
      x: context.startX,
      y: context.startY
    });
  }

  private handlePanEnd(): void {
    this.emit<{}>('panEnd', {});
    this.stateMachine.updateContext({
      startX: 0,
      startY: 0
    });
  }

  private handlePan(e: PointerEvent): void {
    const context = this.stateMachine.getContext();
    const deltaX = e.clientX - context.startX;
    const deltaY = e.clientY - context.startY;

    this.emit<PanEventDetail>('pan', { deltaX, deltaY });

    this.stateMachine.updateContext({
      startX: e.clientX,
      startY: e.clientY
    });
  }

  private handleDrag(e: PointerEvent): void {
    this.emit<DragEventDetail>('drag', {
      x: e.clientX,
      y: e.clientY
    });
  }

  private setupEventListeners(): void {
    // Space key events
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.stateMachine.transition('SPACE_DOWN');
        
        if (this.stateMachine.getState() === 'readyToPan') {
          const rect = this.element.getBoundingClientRect();
          this.stateMachine.updateContext({
            startX: rect.x,
            startY: rect.y
          });
        }
      }
    });

    document.addEventListener('keyup', (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        this.stateMachine.transition('SPACE_UP');
      }
    });

    // Pointer events
    this.element.addEventListener('pointerdown', (e: PointerEvent) => {
      this.stateMachine.transition('POINTER_DOWN');
      if (this.stateMachine.getState() === 'panning') {
        this.stateMachine.updateContext({
          startX: e.clientX,
          startY: e.clientY
        });
      }
    });

    document.addEventListener('pointermove', (e: PointerEvent) => {
      const currentState = this.stateMachine.getState();
      
      if (currentState === 'panning') {
        this.handlePan(e);
      } else if (currentState === 'regularDrag') {
        this.handleDrag(e);
      }
    });

    document.addEventListener('pointerup', () => {
      this.stateMachine.transition('POINTER_UP');
    });
  }

  private emit<T>(eventName: string, detail: T): void {
    const event = new CustomEvent<T>(eventName, { detail });
    this.element.dispatchEvent(event);
  }

  destroy(): void {
    this.stateMachine.removeListener(this.boundHandleStateChange);
    // Additional cleanup if needed
  }
}

interface HTMLElementEventMap {
    'pan': CustomEvent<PanEventDetail>;
    'panStart': CustomEvent<DragEventDetail>;
    'panEnd': CustomEvent<{}>;
    'drag': CustomEvent<DragEventDetail>;
    'stateChange': CustomEvent<StateChangeEventDetail>;
}


// Usage example:
/*
const element = document.getElementById('pannable');
if (element) {
  const controller = new PanController(element);
  
  element.addEventListener('pan', (e) => {
    const { deltaX, deltaY } = e.detail;
    element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
  });

  element.addEventListener('stateChange', (e) => {
    const { prevState, newState } = e.detail;
    console.log(`State changed from ${prevState} to ${newState}`);
  });
}
*/
import vCanvas from "../vCanvas";

export interface AttributeChangeCommand {
    execute(newValue: string): void;
}

export class SetWidthCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        this.canvas.width = +newValue;
    }
}

export class SetHeightCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        this.canvas.height = +newValue;
    }
}

export class ToggleFullScreenCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        if(newValue === 'true'){
            this.canvas.fullScreenFlag = true;
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        } else {
            this.canvas.fullScreenFlag = false;
        }
    }
}

export class ToggleStepFunctionCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        if(newValue === 'true'){
            this.canvas.stepControl = true;
        } else {
            this.canvas.stepControl = false;
        }
    }
}

export class RestrictXTranslationCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        if(newValue === 'true'){
            this.canvas.restrictXTranslation = true;
        } else {
            this.canvas.restrictXTranslation = false;
        }
    }
}

export class RestrictYTranslationCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        if(newValue === 'true'){
            this.canvas.restrictYTranslation = true;
        } else {
            this.canvas.restrictYTranslation = false;
        }
    }
}

export class RestrictTranslationCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        if(newValue === 'true'){
            this.canvas.restrictXTranslation = true;
            this.canvas.restrictYTranslation = true;
        } else {
            this.canvas.restrictXTranslation = false;
            this.canvas.restrictYTranslation = false;
        }
    }
}

export class RestrictRotationCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        if(newValue === 'true'){
            this.canvas.restrictRotation = true;
        } else {
            this.canvas.restrictRotation = false;
        }
    }
}

export class RestrictZoomCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        if(newValue === 'true'){
            this.canvas.restrictZoom = true;
        } else {
            this.canvas.restrictZoom = false;
        }
    }
}

export class RestrictRelativeXTranslationCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        if(newValue === 'true'){
            this.canvas.restrictRelativeXTranslation = true;
        } else {
            this.canvas.restrictRelativeXTranslation = false;
        }
    }
}

export class RestrictRelativeYTranslationCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        if(newValue === 'true'){
            this.canvas.restrictRelativeYTranslation = true;
        } else {
            this.canvas.restrictRelativeYTranslation = false;
        }
    }
}

export class SetMaxHalfTransHeightCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        this.canvas.maxTransHalfHeight = +newValue;
    }
}

export class SetMaxHalfTransWidthCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        this.canvas.maxTransHalfWidth = +newValue;
    }
}


export class SetDebugModeCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        this.canvas.debugMode = newValue === 'true';
        if (newValue == "true") {
            this.canvas.getInternalCanvas().style.cursor = "none";
        } else {
            this.canvas.getInternalCanvas().style.cursor = "auto";
        }
    }
}

export class ToggleGridCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        if(newValue === 'true' || newValue === ""){
            this.canvas.displayGrid = true;
        } else {
            this.canvas.displayGrid = false;
        }
    }
}

export class ToggleRulerCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        if(newValue === 'true' || newValue === ""){
            this.canvas.displayRuler = true;
        } else {
            this.canvas.displayRuler = false;
        }
    }
}

export class SetVerticalGridSizeCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        this.canvas.verticalGridSize = +newValue;
    }
}

export class SetHorizontalGridSizeCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        this.canvas.horizontalGridSize = +newValue;
    }
}
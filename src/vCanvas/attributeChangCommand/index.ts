import { vCanvas } from "../vCanvas";;

export interface AttributeChangeCommand {
    execute(newValue: string): void;
}

export class SetWidthCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        this.canvas.setCanvasWidth(+newValue)
    }
}

export class SetHeightCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        this.canvas.setCanvasHeight(+newValue)
    }
}

export class ToggleFullScreenCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        this.canvas.toggleFullScreen(newValue === 'true');
    }
}

export class ToggleStepFunctionCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        this.canvas.toggleStepFunction(newValue === 'true');
    }
}

export class RestrictXTranslationCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        this.canvas.toggleXTranslationRestriction(newValue === 'true');
    }
}

export class RestrictYTranslationCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        this.canvas.toggleYTranslationRestriction(newValue === 'true');
    }
}

export class RestrictTranslationCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        this.canvas.toggleTranslationRestriction(newValue === 'true');
    }
}

export class RestrictRotationCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        this.canvas.toggleRotationRestriction(newValue === 'true');
    }
}

export class RestrictZoomCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        this.canvas.toggleZoomRestriction(newValue === 'true');
    }
}

export class RestrictRelativeXTranslationCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        this.canvas.toggleRelativeXTranslationRestriction(newValue === 'true');
    }
}

export class RestrictRelativeYTranslationCommand implements AttributeChangeCommand {
    constructor(private canvas: vCanvas) { }

    execute(newValue: string): void {
        this.canvas.toggleRelativeYTranslationRestriction(newValue === 'true');
    }
}
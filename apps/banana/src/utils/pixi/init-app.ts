import {
    CameraRig,
    DefaultBoardCamera,
    InputOrchestrator,
    KmtInputStateMachine,
    StateMachine,
    TouchEventParser,
    TouchInputTracker,
    VanillaTouchEventParser,
    createDefaultCameraRig,
    createTouchInputStateMachine,
} from '@ue-too/board';
import { RawUserInputPublisher } from '@ue-too/board';
import {
    CanvasProxy,
    ObservableInputTracker,
    createKmtInputStateMachine,
} from '@ue-too/board';
import {
    KMTEventParser,
    VanillaKMTEventParser,
    createCameraMuxWithAnimationAndLock,
} from '@ue-too/board';
import { PixiInputParser } from '@ue-too/board-pixi-integration';
import { Application, Assets, Graphics, Matrix, Sprite } from 'pixi.js';
import { createKnitInputStateMachine } from '../input-state-machine/knit-input-state-machine';
import { PixiCanvasResult } from '@/contexts/pixi';

export type PixiAppComponents = {
    app: Application;
    camera: DefaultBoardCamera;
    canvasProxy: CanvasProxy;
    cameraRig: CameraRig;
    inputOrchestrator: InputOrchestrator;
    observableInputTracker: ObservableInputTracker;
    kmtInputStateMachine: StateMachine;
    kmtParser: KMTEventParser;
    touchParser: TouchEventParser;
    cleanup: () => void;
    cleanups: (() => void)[];
};

export const initApp = async (
    canvasElement: HTMLCanvasElement,
    option: { fullScreen: boolean } = { fullScreen: true }
): Promise<PixiAppComponents> => {
    // Create a PixiJS application.
    console.log('canvasElement', canvasElement);
    const app = new Application();

    const cleanups: (() => void)[] = [];

    const camera = new DefaultBoardCamera({
        viewPortWidth: canvasElement.width,
        viewPortHeight: canvasElement.height,
        position: { x: 0, y: 0 },
        rotation: 0,
        zoomLevel: 1,
        boundaries: { min: { x: -1000, y: -1000 }, max: { x: 1000, y: 1000 } },
    });

    const canvasProxy = new CanvasProxy(canvasElement);
    const cameraRig = createDefaultCameraRig(camera);
    const inputOrchestrator = new InputOrchestrator(
        createCameraMuxWithAnimationAndLock(),
        cameraRig,
        new RawUserInputPublisher()
    );
    const observableInputTracker = new ObservableInputTracker(canvasProxy);
    const touchInputTracker = new TouchInputTracker(canvasProxy);
    // const kmtInputStateMachine = createKmtInputStateMachine(
    //     observableInputTracker
    // );
    const kmtInputStateMachine = createKnitInputStateMachine(observableInputTracker);

    const touchInputStateMachine =
        createTouchInputStateMachine(touchInputTracker);

    // Intialize the application.
    await app.init({
        preference: 'webgpu',
        resolution: devicePixelRatio,
        autoDensity: true,
        canvas: canvasElement,
        antialias: true,
        backgroundAlpha: 0,
        resizeTo: option.fullScreen ? window : undefined,
    });

    camera.viewPortHeight = app.renderer.height;
    camera.viewPortWidth = app.renderer.width;

    // Listen for canvas resize events
    app.renderer.on('resize', (width: number, height: number) => {
        camera.viewPortWidth = width;
        camera.viewPortHeight = height;
    });

    const kmtParser = new VanillaKMTEventParser(
        kmtInputStateMachine,
        inputOrchestrator,
        app.canvas
    );
    kmtParser.setUp();

    const touchParser = new VanillaTouchEventParser(
        touchInputStateMachine,
        inputOrchestrator,
        app.canvas
    );
    touchParser.setUp();

    // const pixiInputParser = new PixiInputParser(app, kmtInputStateMachine, inputOrchestrator, camera);
    // pixiInputParser.setUp();

    // Load the bunny texture.
    const imageUrl = new URL('../../../assets/bala.png', import.meta.url).href;
    const texture = await Assets.load(imageUrl);
    // Create a new Sprite from an image path.
    const bala = new Sprite(texture);

    // app.stage.addChild(bala);

    // console.log('hmr test');
    // Add to stage.
    // console.log(camera.contextTransform);
    const transform = camera.getTransform(1);
    if (
        transform.a !== app.stage.localTransform.a ||
        transform.b !== app.stage.localTransform.b ||
        transform.c !== app.stage.localTransform.c ||
        transform.d !== app.stage.localTransform.d ||
        transform.e !== app.stage.localTransform.tx ||
        transform.f !== app.stage.localTransform.ty
    ) {
        app.stage.setFromMatrix(
            new Matrix(
                transform.a,
                transform.b,
                transform.c,
                transform.d,
                transform.e,
                transform.f
            )
        );
    }

    // app.stage.addChild(bala);

    // Center the sprite's anchor point.
    bala.anchor.set(0.5);

    // Move the sprite to the center of the screen.
    bala.x = 0;
    bala.y = 0;

    // Add an animation loop callback to the application's ticker.
    app.ticker.add(time => {
        const transform = camera.getTransform(1);
        if (
            transform.a !== app.stage.localTransform.a ||
            transform.b !== app.stage.localTransform.b ||
            transform.c !== app.stage.localTransform.c ||
            transform.d !== app.stage.localTransform.d ||
            transform.e !== app.stage.localTransform.tx ||
            transform.f !== app.stage.localTransform.ty
        ) {
            // pixiInputParser.updateHitArea();
            app.stage.setFromMatrix(
                new Matrix(
                    transform.a,
                    transform.b,
                    transform.c,
                    transform.d,
                    transform.e,
                    transform.f
                )
            );

        }
    });

    const cleanup = () => {
        // pixiInputParser.tearDown();
        kmtParser.tearDown();
        canvasProxy.tearDown();
        touchParser.tearDown();
    };

    return {
        app,
        camera,
        canvasProxy,
        cameraRig,
        inputOrchestrator,
        observableInputTracker,
        kmtInputStateMachine,
        kmtParser,
        touchParser,
        cleanup,
        cleanups,
    };
};

export const appIsReady = (result: PixiCanvasResult): { ready: false } | { ready: true, app: Application } => {
    if (result.initialized == false || result.success == false || result.components.app.renderer == null) {
        return { ready: false };
    }
    return { ready: true, app: result.components.app };
};

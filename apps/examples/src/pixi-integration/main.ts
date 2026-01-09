import { DefaultBoardCamera, EdgeAutoCameraInput, InputOrchestrator, createDefaultCameraRig } from '@ue-too/board';
import { Application, Assets, Graphics, Matrix, Sprite, PixiTouch } from 'pixi.js';
import { VanillaKMTEventParser } from '@ue-too/board';
import { RawUserInputPublisher } from '@ue-too/board';
import { CanvasProxy, createKmtInputStateMachine, ObservableInputTracker } from '@ue-too/board';
import { createCameraMuxWithAnimationAndLock } from '@ue-too/board';
import { PixiInputParser } from '@ue-too/board-pixi-integration';

// Asynchronous IIFE
(async () =>
{
    // Create a PixiJS application.
    const app = new Application();

    // Intialize the application.
    await app.init({ background: '#1099bb', resolution: devicePixelRatio, autoDensity: true, canvas: document.querySelector("#graph") as HTMLCanvasElement, antialias: true });

    
    const camera = new DefaultBoardCamera(app.screen.width, app.screen.height, {x: 100, y: 100}, 0, 2);
    const canvasProxy = new CanvasProxy(app.canvas);
    const cameraRig = createDefaultCameraRig(camera);
    const inputOrchestrator = new InputOrchestrator(createCameraMuxWithAnimationAndLock(), cameraRig, new RawUserInputPublisher());
    const observableInputTracker = new ObservableInputTracker(canvasProxy);
    const kmtInputStateMachine = createKmtInputStateMachine(observableInputTracker);
    console.log('kmt input state machine', kmtInputStateMachine);
    const kmtParser = new VanillaKMTEventParser(kmtInputStateMachine, inputOrchestrator, app.canvas);
    // kmtParser.setUp();

    const pixiInputParser = new PixiInputParser(app, kmtInputStateMachine, inputOrchestrator, camera);
    pixiInputParser.setUp();
    pixiInputParser.showHitAreaDebug();

    // Load the bunny texture.
    const texture = await Assets.load('https://pixijs.com/assets/bunny.png');
    // Create a new Sprite from an image path.
    const bunny = new Sprite(texture);

    // app.stage.setFromMatrix(new Matrix(1, 0, 0, 1, app.screen.width / 2, app.screen.height / 2));

    // Add to stage.
    // console.log(camera.contextTransform);
    const transform = camera.getTransform(1);
    app.stage.setFromMatrix(new Matrix(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f));

    app.stage.addChild(bunny);
    app.stage.addChild(new Graphics().arc(0, 0, 100, 0, Math.PI * 2).fill({color: 0x000000, alpha: 0.5}));

    // Center the sprite's anchor point.
    bunny.anchor.set(0.5);

    // Move the sprite to the center of the screen.
    bunny.x = 100;
    bunny.y = 100;

    // Add an animation loop callback to the application's ticker.
    app.ticker.add((time) =>
    {
        const transform = camera.getTransform(1, true);
        app.stage.setFromMatrix(new Matrix(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f));
    });
})();

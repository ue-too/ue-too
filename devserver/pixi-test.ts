import DefaultBoardCamera from 'src/board-camera';
import { Application, Assets, Graphics, Matrix, Sprite, PixiTouch } from 'pixi.js';
import { DefaultBoardKMTStrategy } from 'src/kmt-strategy';
import { createDefaultRawUserInputObservable } from 'src/input-observer';

console.log("pixi-test");
// Asynchronous IIFE
(async () =>
{
    // Create a PixiJS application.
    const app = new Application();

    // Intialize the application.
    await app.init({ background: '#1099bb', resolution: devicePixelRatio, autoDensity: true, canvas: document.querySelector("#graph") as HTMLCanvasElement, antialias: true });
    // app.canvas.style.width = app.screen.width + "px";
    // app.canvas.style.height = app.screen.height + "px";
    // console.log(app.screen.width, app.screen.height);
    // console.log(app.canvas.width, app.canvas.height);
    // app.renderer.events.autoPreventDefault = true;
    
    const camera = new DefaultBoardCamera(app.screen.width, app.screen.height, {x: 100, y: 100}, 0, 2);

    const kmtStrategy = new DefaultBoardKMTStrategy(app.canvas, app.canvas, createDefaultRawUserInputObservable(camera), false)
    kmtStrategy.setUp();
    // app.renderer.events.rootBoundary.addEventMapping
    // app.stage.hitArea = app.screen;
    // app.stage.interactive = true;
    // app.stage.on("wheel", (event)=>{
    //     event.preventDefault();
    //     event.stopPropagation();
    //     console.log("wheel");
    // }, { passive: false});

    // Then adding the application's canvas to the DOM body.
    // document.body.appendChild(app.canvas);

    // Load the bunny texture.
    const texture = await Assets.load('https://pixijs.com/assets/bunny.png');
    // Create a new Sprite from an image path.
    const bunny = new Sprite(texture);

    // app.stage.setFromMatrix(new Matrix(1, 0, 0, 1, app.screen.width / 2, app.screen.height / 2));

    // Add to stage.
    // console.log(camera.contextTransform);
    const transform = camera.getTransform(1, true);
    app.stage.setFromMatrix(new Matrix(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f));

    app.stage.addChild(bunny);
    app.stage.addChild(new Graphics().arc(0, 0, 10, 0, Math.PI * 2).fill({color: 0x000000, alpha: 0.5}));

    // Center the sprite's anchor point.
    bunny.anchor.set(0.5);

    // Move the sprite to the center of the screen.
    bunny.x = 100;
    bunny.y = 100;

    // Add an animation loop callback to the application's ticker.
    app.ticker.add((time) =>
    {
        /**
         * Just for fun, let's rotate mr rabbit a little.
         * Time is a Ticker object which holds time related data.
         * Here we use deltaTime, which is the time elapsed between the frame callbacks
         * to create frame-independent transformation. Keeping the speed consistent.
         */
        const transform = camera.getTransform(1, true);
        app.stage.setFromMatrix(new Matrix(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f));
    });
})();
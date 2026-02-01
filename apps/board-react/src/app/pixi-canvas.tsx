import {
    useCanvasProxy,
    useCanvasProxyWithRef,
} from '@ue-too/board-react-adapter';
import { Application, Assets, Container, Sprite } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';

export function PixiCanvas() {
    const [app, _] = useState(() => new Application());
    const canvasProxy = useCanvasProxyWithRef();

    useEffect(() => {
        (async (): Promise<void> => {
            const container = new Container();

            app.stage.addChild(container);

            // Load the bunny texture
            const texture = await Assets.load(
                'https://pixijs.com/assets/bunny.png'
            );

            // Create a 5x5 grid of bunnies in the container
            for (let i = 0; i < 25; i++) {
                const bunny = new Sprite(texture);

                bunny.x = (i % 5) * 40;
                bunny.y = Math.floor(i / 5) * 40;
                container.addChild(bunny);
            }

            // Move the container to the center
            container.x = app.screen.width / 2;
            container.y = app.screen.height / 2;

            // Center the bunny sprites in local container coordinates
            container.pivot.x = container.width / 2;
            container.pivot.y = container.height / 2;

            app.ticker.add(time => {
                container.rotation -= 0.01 * time.deltaTime;
            });
        })();
    }, [app]);

    return (
        <canvas
            ref={ref => {
                if (ref == null) {
                    console.log('canvas destroyed');
                    return;
                }
                canvasProxy.refCallback(ref);
                app.init({
                    canvas: ref,
                    background: '#1099bb',
                    resolution: devicePixelRatio,
                    autoDensity: true,
                    antialias: true,
                });
            }}
            width={1000}
            height={1000}
        />
    );
}

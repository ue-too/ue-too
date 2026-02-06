import { Outlet, createRootRoute } from '@tanstack/react-router';

export const Route = createRootRoute({
    component: RootComponent,
});

function RootComponent() {
    return (
        <div className="app">
            <Outlet />
        </div>
    );
}

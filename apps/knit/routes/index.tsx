import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
    component: HomeComponent,
});

function HomeComponent() {
    return (
        <div>
            <h1>Knit</h1>
        </div>
    );
}

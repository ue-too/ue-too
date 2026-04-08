import { useSceneStore } from '@/stores/scene-store';

export function SceneLoadingOverlay(): React.ReactNode {
    const loading = useSceneStore((s) => s.sceneLoading);
    const progress = useSceneStore((s) => s.sceneLoadProgress);

    if (!loading) return null;

    const percent = Math.round(progress * 100);

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                pointerEvents: 'all',
            }}
        >
            <div
                style={{
                    backgroundColor: 'var(--background, #1a1a1a)',
                    borderRadius: 8,
                    padding: '24px 32px',
                    minWidth: 280,
                    textAlign: 'center',
                    color: 'var(--foreground, #fff)',
                }}
            >
                <p style={{ margin: '0 0 12px', fontSize: 14 }}>
                    Loading scene... {percent}%
                </p>
                <div
                    style={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            height: '100%',
                            width: `${percent}%`,
                            borderRadius: 3,
                            backgroundColor: 'var(--primary, #3b82f6)',
                            transition: 'width 100ms ease-out',
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

/**
 * Tracks a custom event via Umami analytics.
 * No-ops silently if Umami is not loaded (e.g., ad blockers, local dev).
 *
 * @param name - Event name (e.g., 'cta-click')
 * @param data - Optional event properties
 */
export function trackEvent(
    name: string,
    data?: Record<string, string | number | boolean>
): void {
    if (typeof window !== 'undefined' && window.umami?.track) {
        window.umami.track(name, data);
    }
}

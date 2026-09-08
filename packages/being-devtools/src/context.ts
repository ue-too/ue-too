/** Default cap on the serialized context text. @category Types */
export const MAX_CONTEXT_CHARS = 2000;

/**
 * Pretty-prints a machine's context for the inspector: functions are
 * dropped, circular references become `"[circular]"`, and text beyond
 * `maxChars` is cut and marked with an ellipsis line.
 *
 * @category Helpers
 */
export function serializeContext(
    context: unknown,
    maxChars: number = MAX_CONTEXT_CHARS
): string {
    if (context === undefined || context === null) {
        return '';
    }
    const seen = new WeakSet<object>();
    let text: string | undefined;
    try {
        text = JSON.stringify(
            context,
            (_key, value: unknown) => {
                if (typeof value === 'function') {
                    return undefined;
                }
                if (typeof value === 'object' && value !== null) {
                    if (seen.has(value)) {
                        return '[circular]';
                    }
                    seen.add(value);
                }
                return value;
            },
            2
        );
    } catch {
        return '(context not serializable)';
    }
    if (text === undefined) {
        return '(context not serializable)';
    }
    return text.length > maxChars ? `${text.slice(0, maxChars)}\n…` : text;
}

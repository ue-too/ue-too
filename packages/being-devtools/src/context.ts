/** Default cap on the serialized context text. @category Types */
export const MAX_CONTEXT_CHARS = 2000;

/**
 * Pretty-prints a machine's context for the inspector: functions are
 * dropped, true circular references become `"[circular]"` (shared but
 * acyclic sub-objects are serialized in full), and text beyond `maxChars`
 * is cut and marked with an ellipsis line.
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
    const ancestors: object[] = [];
    let text: string | undefined;
    try {
        text = JSON.stringify(
            context,
            function (this: unknown, _key: string, value: unknown) {
                if (typeof value === 'function') {
                    return undefined;
                }
                if (typeof value !== 'object' || value === null) {
                    return value;
                }
                // Unwind to the object that owns `key`; anything deeper was a
                // sibling branch we have already left.
                while (
                    ancestors.length > 0 &&
                    ancestors[ancestors.length - 1] !== this
                ) {
                    ancestors.pop();
                }
                if (ancestors.includes(value)) {
                    return '[circular]';
                }
                ancestors.push(value);
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

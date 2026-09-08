/**
 * A parsed keyboard shortcut such as `ctrl+shift+m`.
 *
 * @remarks
 * `ctrl` is satisfied by either the Control key or the Command/Meta key,
 * so one spec works on every platform.
 *
 * @category Types
 */
export type ParsedHotkey = {
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    /** Lower-cased key name, as reported by `KeyboardEvent.key`. */
    key: string;
};

/**
 * The subset of `KeyboardEvent` that {@link matchesHotkey} reads.
 *
 * @category Types
 */
export type HotkeyEventLike = {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
};

/**
 * Parses a `+`-separated shortcut spec. Modifier words are `ctrl`, `cmd`,
 * `meta` (all meaning {@link ParsedHotkey.ctrl}), `shift`, `alt`, `option`.
 * Exactly one non-modifier word is required.
 *
 * @throws Error when the spec names no key or more than one key.
 * @category Helpers
 */
export function parseHotkey(spec: string): ParsedHotkey {
    const parts = spec
        .toLowerCase()
        .split('+')
        .map(part => part.trim())
        .filter(part => part.length > 0);
    const parsed: ParsedHotkey = {
        ctrl: false,
        shift: false,
        alt: false,
        key: '',
    };
    for (const part of parts) {
        if (part === 'ctrl' || part === 'cmd' || part === 'meta') {
            parsed.ctrl = true;
        } else if (part === 'shift') {
            parsed.shift = true;
        } else if (part === 'alt' || part === 'option') {
            parsed.alt = true;
        } else if (parsed.key === '') {
            parsed.key = part;
        } else {
            throw new Error(`Hotkey "${spec}" names more than one key`);
        }
    }
    if (parsed.key === '') {
        throw new Error(`Hotkey "${spec}" has no key`);
    }
    return parsed;
}

/**
 * True when the event's key and modifier set equal the hotkey exactly.
 * Extra modifiers do not match; Control and Meta are interchangeable.
 *
 * @category Helpers
 */
export function matchesHotkey(
    event: HotkeyEventLike,
    hotkey: ParsedHotkey
): boolean {
    return (
        event.key.toLowerCase() === hotkey.key &&
        (event.ctrlKey || event.metaKey) === hotkey.ctrl &&
        event.shiftKey === hotkey.shift &&
        event.altKey === hotkey.alt
    );
}

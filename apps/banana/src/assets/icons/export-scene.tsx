import type { IconProps } from './icon-types';

export function ExportSceneIcon({
    title = 'Export scene',
    ...props
}: IconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <title>{title}</title>
            <rect x="3" y="2" width="10" height="11" rx="2" />
            <path d="M6 5h4v3H6z" />
            <path d="M5 13l-3 8" />
            <path d="M11 13l3 8" />
            <path d="M1 17h14" />
            <path d="M1 21h14" />
            <path d="M16 20h7" />
            <path d="M22 7l-3-3-3 3" />
            <path d="M19 17V4" />
        </svg>
    );
}

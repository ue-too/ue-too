import type { IconProps } from './icon-types';

export function ExportTrainIcon({
    title = 'Export trains',
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
            <rect x="3" y="5" width="10" height="12" rx="2" />
            <path d="M6 8h4v3H6z" />
            <circle cx="5.5" cy="17.5" r="1.5" />
            <circle cx="10.5" cy="17.5" r="1.5" />
            <path d="M16 20h7" />
            <path d="M22 7l-3-3-3 3" />
            <path d="M19 17V4" />
        </svg>
    );
}

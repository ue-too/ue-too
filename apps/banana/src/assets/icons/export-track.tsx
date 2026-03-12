import type { IconProps } from './icon-types';

export function ExportTrackIcon({
    title = 'Export tracks',
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
            <path d="M5 2v20" />
            <path d="M11 2v20" />
            <path d="M2 6h12" />
            <path d="M2 12h12" />
            <path d="M2 18h12" />
            <path d="M16 20h7" />
            <path d="M22 7l-3-3-3 3" />
            <path d="M19 17V4" />
        </svg>
    );
}

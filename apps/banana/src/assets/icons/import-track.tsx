import type { IconProps } from './icon-types';

export function ImportTrackIcon({ title = 'Import tracks', ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label={title}
      role="img"
      {...props}
    >
      <title>{title}</title>
      {/* rails */}
      <path d="M7 3v8" />
      <path d="M17 3v8" />
      <path d="M9.5 4.5h5" />
      <path d="M9.5 7.5h5" />
      <path d="M9.5 10.5h5" />
      {/* import arrow */}
      <path d="M12 20v-7" />
      <path d="M15.5 16.5 12 13l-3.5 3.5" />
    </svg>
  );
}


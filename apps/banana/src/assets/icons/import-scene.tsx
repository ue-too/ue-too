import type { IconProps } from './icon-types';

export function ImportSceneIcon({ title = 'Import scene', ...props }: IconProps) {
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
      {/* stacked layers (scene) */}
      <path d="M12 3 3 7l9 4 9-4-9-4Z" />
      <path d="M3 12l9 4 9-4" />
      {/* import arrow */}
      <path d="M12 21V11" />
      <path d="M15 14l-3-3-3 3" />
    </svg>
  );
}


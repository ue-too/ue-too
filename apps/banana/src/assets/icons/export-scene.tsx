import type { IconProps } from './icon-types';

export function ExportSceneIcon({ title = 'Export scene', ...props }: IconProps) {
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
      {/* export arrow */}
      <path d="M12 11v10" />
      <path d="M9 18l3 3 3-3" />
    </svg>
  );
}


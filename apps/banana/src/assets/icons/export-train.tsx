import type { IconProps } from './icon-types';

export function ExportTrainIcon({ title = 'Export trains', ...props }: IconProps) {
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
      {/* simple train front */}
      <path d="M7 4h10a2 2 0 0 1 2 2v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2Z" />
      <path d="M8 8h3" />
      <path d="M13 8h3" />
      <path d="M8 16l-2 3" />
      <path d="M16 16l2 3" />
      {/* export arrow */}
      <path d="M12 12v9" />
      <path d="M9.5 18.5 12 21l2.5-2.5" />
    </svg>
  );
}


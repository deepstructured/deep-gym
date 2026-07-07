import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function IconEdit(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9.5" />
    </svg>
  );
}

export function IconHistory(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 12a9 9 0 109-9 9.5 9.5 0 00-6.5 2.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

export function IconDumbbell(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6.5 6.5v11M17.5 6.5v11" />
      <path d="M3 9v6M21 9v6" />
      <path d="M6.5 12h11" />
    </svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.56V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1-1.56 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.56-1H3a2 2 0 110-4h.09a1.7 1.7 0 001.56-1 1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34h.01a1.7 1.7 0 001-1.56V3a2 2 0 114 0v.09a1.7 1.7 0 001 1.56h.01a1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87v.01a1.7 1.7 0 001.56 1H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.56 1z" />
    </svg>
  );
}

export function IconFlame(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 21c4 0 6.5-2.6 6.5-6.2 0-2.5-1.4-4.6-2.9-6.3-.6 1-1.3 1.7-2.1 2.1C13.4 8.5 13 5.5 10.5 3c-.3 2.4-1.2 4-2.6 5.6C6.5 10.2 5.5 12 5.5 14.8 5.5 18.4 8 21 12 21z" />
    </svg>
  );
}

export function IconPlates(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}

export function IconCompare(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8h13" />
      <path d="M14 5l3 3-3 3" />
      <path d="M20 16H7" />
      <path d="M10 13l-3 3 3 3" />
    </svg>
  );
}

export function IconNote(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 4a1 1 0 011-1h9l4 4v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4z" />
      <path d="M15 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}

export function IconLogout(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function IconTelegram({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M21.94 4.35a1.5 1.5 0 00-2.03-1.7L2.9 9.3c-1.35.53-1.26 2.47.13 2.87l4.4 1.27 1.7 5.43c.4 1.28 2.03 1.6 2.9.58l1.85-2.2 4.06 2.98c1.03.76 2.5.18 2.73-1.08l2.27-14.8zM8.4 12.7l9.1-5.6c.4-.25.83.3.48.62l-7.1 6.53c-.24.22-.4.52-.44.85l-.28 2.2c-.03.3-.45.34-.54.05l-1.13-3.7a.9.9 0 01.4-1.05z" />
    </svg>
  );
}

export function IconGoogle({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 01-2.4 3.62v3h3.87c2.27-2.09 3.58-5.17 3.58-8.8z"
        fill="#4285F4"
      />
      <path
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3a7.24 7.24 0 01-10.8-3.8H1.26v3.1A12 12 0 0012 24z"
        fill="#34A853"
      />
      <path
        d="M5.27 14.28a7.2 7.2 0 010-4.56v-3.1H1.26a12 12 0 000 10.77l4.01-3.11z"
        fill="#FBBC05"
      />
      <path
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.98 11.98 0 001.26 6.62l4 3.1A7.17 7.17 0 0112 4.75z"
        fill="#EA4335"
      />
    </svg>
  );
}

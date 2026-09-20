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

export function IconShare(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 15V3" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
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

export function IconMinus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function IconChart(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 4v15a1 1 0 001 1h15" />
      <path d="M8 15l3.5-4 3 2.5L20 7" />
    </svg>
  );
}

export function IconLibrary(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="4" width="5" height="16" rx="1.5" />
      <rect x="10.5" y="4" width="5" height="16" rx="1.5" />
      <path d="M17.6 5.2l3 14.3" />
    </svg>
  );
}

export function IconTemplate(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="3.5" width="16" height="6" rx="2" />
      <rect x="4" y="13" width="7" height="7.5" rx="2" />
      <rect x="14" y="13" width="6" height="7.5" rx="2" />
    </svg>
  );
}

export function IconWidgets(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="17" height="7" rx="2" />
    </svg>
  );
}

export function IconExpand(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  );
}

export function IconTrophy(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 4h8v5a4 4 0 01-8 0V4z" />
      <path d="M8 6H5a2.5 2.5 0 003 4M16 6h3a2.5 2.5 0 01-3 4" />
      <path d="M12 13v4M8.5 20.5h7M9.5 17h5" />
    </svg>
  );
}

export function IconScale(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M8 9a5 5 0 018 0" />
      <path d="M12 9.5l1.4-2" />
    </svg>
  );
}

export function IconBolt(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z" />
    </svg>
  );
}

export function IconRepeat(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M17 3l3 3-3 3" />
      <path d="M4 11V9a3 3 0 013-3h13" />
      <path d="M7 21l-3-3 3-3" />
      <path d="M20 13v2a3 3 0 01-3 3H4" />
    </svg>
  );
}

export function IconTarget(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0115 0" />
    </svg>
  );
}

export function IconGlobe(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
    </svg>
  );
}

export function IconSparkles(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M11 3l1.8 4.7L17.5 9.5l-4.7 1.8L11 16l-1.8-4.7L4.5 9.5l4.7-1.8L11 3z" />
      <path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconMuscle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 17.5c1.5-4.5 2-8.5 1.2-12.5 2 .3 3.2 1.5 3.6 3.5" />
      <path d="M9.5 9.3c2.8-1.4 6.3-.8 8.3 1.6 2 2.5 1.7 5.9-.6 7.6-2.8 2-7.8 1.6-12.2-1" />
      <path d="M12.5 13.5c1.2-.7 2.8-.6 3.8.3" />
    </svg>
  );
}

/** Six-dot drag grip. */
export function IconGrip(props: IconProps) {
  return (
    <svg {...base({ ...props, fill: "currentColor", stroke: "none" })}>
      {[6, 12, 18].flatMap((y) => [
        <circle key={`l${y}`} cx="9" cy={y} r="1.5" />,
        <circle key={`r${y}`} cx="15" cy={y} r="1.5" />,
      ])}
    </svg>
  );
}

export function IconArrowUp(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 4.5v15l12.5-7.5L7 4.5z" fill="currentColor" />
    </svg>
  );
}

export function IconFilter(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

export function IconMonitor(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M9 20h6M12 16v4" />
    </svg>
  );
}

export function IconPhone(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </svg>
  );
}

export function IconAuto(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2.5" y="5" width="13" height="10" rx="2" />
      <path d="M16.5 9.5h3a2 2 0 012 2v5a2 2 0 01-2 2h-3a2 2 0 01-2-2v-5a2 2 0 012-2zM7 19h4" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </svg>
  );
}

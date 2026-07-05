"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/cn";
import {
  IconDumbbell,
  IconHistory,
  IconHome,
  IconPlus,
  IconSettings,
} from "@/shared/ui";

const tabs = [
  { href: "/", label: "Home", icon: IconHome },
  { href: "/history", label: "History", icon: IconHistory },
  { href: "/workouts/new", label: "Add", icon: IconPlus, primary: true },
  { href: "/exercises", label: "Exercises", icon: IconDumbbell },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/60 bg-bg/85 backdrop-blur-xl safe-bottom">
      <div className="mx-auto flex max-w-md items-center justify-around px-3 py-2">
        {tabs.map(({ href, label, icon: Icon, primary }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          if (primary) {
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className="flex h-13 w-13 -translate-y-3 items-center justify-center rounded-full bg-lime text-black shadow-[0_10px_30px_-6px_rgba(215,246,81,0.5)] active:brightness-90"
              >
                <Icon size={26} />
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex w-14 flex-col items-center gap-1 py-1 text-[10px] font-medium transition-colors",
                active ? "text-lime" : "text-faint",
              )}
            >
              <Icon size={22} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

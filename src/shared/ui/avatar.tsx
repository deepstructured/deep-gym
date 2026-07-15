import { cn } from "@/shared/lib/cn";

export function DefaultAvatarGlyph({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny local preset
    <img
      src="/avatars/deepgym-pixel-portal.webp"
      alt=""
      width={size}
      height={size}
      aria-hidden="true"
      draggable={false}
      className={cn("block rounded-full object-cover", className)}
    />
  );
}

interface AvatarProps {
  /** Custom avatar URL; null/undefined renders the generated default preset. */
  src?: string | null;
  size?: number;
  alt?: string;
  className?: string;
}

export function Avatar({ src, size = 40, alt = "", className }: AvatarProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatars are tiny user uploads; next/image adds nothing here
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={cn(
          "shrink-0 rounded-full border border-line object-cover",
          className,
        )}
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      role="img"
      aria-label={alt || undefined}
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#0a0a0c]",
        className,
      )}
    >
      <DefaultAvatarGlyph size={size} />
    </span>
  );
}

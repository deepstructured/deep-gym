import { cn } from "@/shared/lib/cn";
import styles from "./avatar.module.scss";

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
      className={cn(styles.glyph, className)}
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
        className={cn(styles.image, className)}
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      role="img"
      aria-label={alt || undefined}
      className={cn(styles.fallback, className)}
    >
      <DefaultAvatarGlyph size={size} />
    </span>
  );
}

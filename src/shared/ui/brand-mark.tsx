import type { ImgHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";

type BrandMarkDetail = "solid" | "compact" | "detailed";

interface BrandMarkProps
  extends Omit<
    ImgHTMLAttributes<HTMLImageElement>,
    "src" | "width" | "height"
  > {
  /** Displayed symbol width in CSS pixels. */
  width?: number;
  /** Override the production-pack size rule when a fixed export is required. */
  detail?: BrandMarkDetail;
}

const MARK_ASPECT_RATIO = 867 / 752;

/** Production Night Reverse symbol with the pack's responsive master rules. */
export function BrandMark({
  width = 32,
  detail,
  alt = "",
  className,
  ...props
}: BrandMarkProps) {
  const resolvedDetail =
    detail ?? (width >= 128 ? "detailed" : width >= 96 ? "compact" : "solid");
  const height = Math.round(width / MARK_ASPECT_RATIO);

  return (
    <img
      src={`/brand/deepgym-symbol-lime-${resolvedDetail}.svg`}
      width={width}
      height={height}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      className={cn("block shrink-0 object-contain", className)}
      {...props}
    />
  );
}

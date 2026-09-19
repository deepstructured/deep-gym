"use client";

import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { IconCheck, IconPlus, Sheet } from "@/shared/ui";
import {
  WIDGETS,
  WIDGET_CATEGORIES,
  WIDGET_TYPES,
  type HomeWidget,
  type WidgetType,
} from "../model/layout";
import { TILES, widgetDescriptionKey, widgetTitleKey } from "./tiles";
import styles from "./widget-gallery.module.scss";

interface WidgetGalleryProps {
  open: boolean;
  onClose: () => void;
  /** Current widgets — single-instance types already on screen show as added. */
  widgets: HomeWidget[];
  onAdd: (type: WidgetType) => void;
}

/** Every available widget, grouped by what it is for. */
export function WidgetGallery({
  open,
  onClose,
  widgets,
  onAdd,
}: WidgetGalleryProps) {
  const { t } = useI18n();
  const present = new Set(widgets.map((widget) => widget.type));

  return (
    <Sheet open={open} onClose={onClose} title={t("dashboard.gallery")}>
      <div className={styles.body}>
        {WIDGET_CATEGORIES.map((category) => (
          <section key={category}>
            <h3 className={styles.category}>
              {t(`dashboard.category.${category}`)}
            </h3>
            <div className={styles.list}>
              {WIDGET_TYPES.filter(
                (type) => WIDGETS[type].category === category,
              ).map((type) => {
                const definition = WIDGETS[type];
                const Icon = TILES[type].icon;
                const added = present.has(type) && !definition.multiple;
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={added}
                    onClick={() => onAdd(type)}
                    className={styles.item}
                  >
                    <span className={cn(styles.icon, styles[`icon_${category}`])}>
                      <Icon size={18} />
                    </span>
                    <span className={styles.text}>
                      <span className={styles.name}>
                        {t(widgetTitleKey(type))}
                      </span>
                      <span className={styles.desc}>
                        {t(widgetDescriptionKey(type))}
                      </span>
                      <span className={styles.sizes}>
                        {definition.sizes.map((size) => (
                          <span key={size} className={styles.sizeTag}>
                            {t(`dashboard.size.${size}`)}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span
                      className={cn(styles.add, added && styles.added)}
                      aria-hidden="true"
                    >
                      {added ? <IconCheck size={16} /> : <IconPlus size={16} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Sheet>
  );
}

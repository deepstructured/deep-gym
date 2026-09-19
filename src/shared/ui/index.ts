// Public API of the UI kit. Each component lives in its own folder next to
// its SCSS module — consumers import from "@/shared/ui", never deep paths.
export { Avatar, DefaultAvatarGlyph } from "./avatar/avatar";
export { BarChart, type BarChartBar } from "./bar-chart/bar-chart";
export { BrandMark } from "./brand-mark/brand-mark";
export { Button } from "./button/button";
export { Calendar } from "./calendar/calendar";
export { Card } from "./card/card";
export { Chip } from "./chip/chip";
export { DotValue } from "./dot-value/dot-value";
export { EmptyState } from "./empty-state/empty-state";
export { ErrorNote } from "./error-note/error-note";
export { Fullscreen } from "./fullscreen/fullscreen";
export { Input, TextArea, Field } from "./input/input";
export { LineChart, type LineChartPoint } from "./line-chart/line-chart";
export { PageLoader } from "./page-loader/page-loader";
export { PeriodSwitch } from "./period-switch/period-switch";
export { Segmented } from "./segmented/segmented";
export { Sheet, ConfirmSheet } from "./sheet/sheet";
export { Spinner } from "./spinner/spinner";
export { Tag } from "./tag/tag";
export { Toggle } from "./toggle/toggle";
export * from "./icons/icons";

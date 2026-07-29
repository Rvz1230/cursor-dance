import { resolveDesktopWindowKind } from "../../shared/desktop-window-kind";
import { exposeOverlayPreload } from "./overlay";
import { exposeWorkbenchPreload } from "./workbench";

const windowKind = resolveDesktopWindowKind(process.argv);

if (windowKind === "workbench") {
  exposeWorkbenchPreload();
} else if (windowKind === "overlay") {
  exposeOverlayPreload();
} else {
  throw new Error("CursorDance preload refused an unknown window kind");
}

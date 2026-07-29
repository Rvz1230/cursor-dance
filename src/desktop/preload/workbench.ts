import { contextBridge } from "electron";
import { createAiBridge } from "./bridges/ai";
import { createDialogBridge } from "./bridges/dialog";
import { createPlatformBridge } from "./bridges/platform";
import { createWindowBridge } from "./bridges/window";
import { createWorkbenchAppBridge } from "./bridges/workbench-app";
import { createWorkbenchStorageBridge } from "./bridges/workbench-storage";

contextBridge.exposeInMainWorld("electronAPI", createPlatformBridge());
contextBridge.exposeInMainWorld("cursorDanceStorage", createWorkbenchStorageBridge());
contextBridge.exposeInMainWorld("cursorDanceDialog", createDialogBridge());
contextBridge.exposeInMainWorld("cursorDanceApp", createWorkbenchAppBridge());
contextBridge.exposeInMainWorld("cursorDanceWindow", createWindowBridge());
contextBridge.exposeInMainWorld("cursorDanceAi", createAiBridge());

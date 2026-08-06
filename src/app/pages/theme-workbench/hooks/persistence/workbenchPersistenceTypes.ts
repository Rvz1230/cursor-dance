import type { MutableRefObject } from "react";
import type {
  WorkbenchConfigRef,
  WorkbenchDispatch,
  WorkbenchState,
} from "../workbenchStateTypes";

export interface WorkbenchPersistenceContext {
  state: WorkbenchState;
  stateRef: MutableRefObject<WorkbenchState>;
  dispatch: WorkbenchDispatch;
  configRef: WorkbenchConfigRef;
}

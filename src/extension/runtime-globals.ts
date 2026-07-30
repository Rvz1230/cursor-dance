import * as actionConfig from "@/shared/effect-core/action-config";
import * as computeSpecs from "@/shared/effect-core/compute-specs";
import * as textSemantics from "@/shared/effect-core/text-semantics";

export const configHelpers = Object.assign(
  globalThis.CursorDanceConfigHelpers || {},
  textSemantics,
  actionConfig,
  computeSpecs,
);

globalThis.CursorDanceConfigHelpers = configHelpers;

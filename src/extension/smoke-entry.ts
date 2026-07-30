import "./runtime-globals";
import { startContentRuntime } from "./content-runtime";
import { loadClassicScript } from "./load-classic-script";

await loadClassicScript("/config.js");
startContentRuntime();

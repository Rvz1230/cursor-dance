import { startServer } from "../src/server.mjs";
import { loadLocalEnv } from "./load-local-env.mjs";

loadLocalEnv({ files: [".env.local", ".env.production", ".env"] });

const PORT = Number.parseInt(process.env.CURSORDANCE_AI_API_PORT || "8787", 10);
const HOST = process.env.CURSORDANCE_AI_API_HOST || "0.0.0.0";

startServer(PORT, HOST);

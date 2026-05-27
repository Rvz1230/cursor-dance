// FC entry point — delegates to the full Node HTTP server app
import { createApp } from "../src/server.mjs";

const app = createApp();

export async function handler(req, res) {
  // Forward the FC3 request to the standard Node HTTP server
  app.emit("request", req, res);
}

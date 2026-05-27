// scheme-proposals-stream — SSE streaming AI scheme proposal
// CJS entry (tested working on FC3 Node.js 20)

exports.handler = async (req, res) => {
  try {
    const mod = await import("../src/server.mjs");
    return await mod.handleSchemeProposalStream(req, res);
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    }
    if (!res.writableEnded) {
      res.end(JSON.stringify({
        error: "Internal server error",
        code: "bootstrap_failed",
        details: err.message,
      }));
    }
  }
};

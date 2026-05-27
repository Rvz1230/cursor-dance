// CursorDance AI API — 阿里云 FC3 统一入口（CJS）
//
// FC3 HTTP 触发器使用自定义 response 对象（setStatusCode / setHeader / send）
// server.mjs 内部使用标准 Node.js res 对象（writeHead / write / end）
// 这里做一个适配器将 FC3 resp 包装成类 Node.js res，让两边都能工作

function createNodeResAdapter(resp) {
  let _status = 200;
  let _headers = {};
  let _headersSent = false;
  let _ended = false;

  return {
    get headersSent() { return _headersSent; },
    get writableEnded() { return _ended; },

    setHeader(name, value) {
      resp.setHeader(name, value);
      _headers[name] = value;
    },

    writeHead(status, headers) {
      _status = status;
      _headersSent = true;
      resp.setStatusCode(status);
      if (headers) {
        Object.entries(headers).forEach(([k, v]) => resp.setHeader(k, v));
      }
    },

    write(chunk) {
      _headersSent = true;
      resp.send(chunk instanceof Buffer ? chunk : String(chunk));
    },

    end(chunk) {
      _ended = true;
      if (!_headersSent) {
        resp.setStatusCode(_status);
      }
      if (chunk !== undefined) {
        resp.send(chunk instanceof Buffer ? chunk : String(chunk));
      } else if (!_headersSent) {
        resp.send("");
      }
    },

    // SSE 流式需要
    flushHeaders() {
      _headersSent = true;
      resp.setStatusCode(200);
    },
  };
}

function setCors(resp) {
  resp.setHeader("Access-Control-Allow-Origin", "*");
  resp.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  resp.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-CursorDance-Client");
}

exports.handler = async (req, resp, ctx) => {
  if (req.method === "OPTIONS") {
    setCors(resp);
    resp.setStatusCode(204);
    resp.send("");
    return;
  }

  const url = req.url || "";

  if (req.method === "GET" && url === "/api/health") {
    setCors(resp);
    resp.setStatusCode(200);
    resp.setHeader("Content-Type", "application/json; charset=utf-8");
    resp.send(JSON.stringify({ ok: true, handler: "fc3-adapter" }));
    return;
  }

  try {
    const { handleSchemeProposal, handleSchemeProposalStream, handleAgentRun } = await import("./src/server.mjs");

    const res = createNodeResAdapter(resp);

    if (req.method === "POST" && url === "/api/ai/scheme-proposals") {
      return handleSchemeProposal(req, res);
    }

    if (req.method === "POST" && url === "/api/ai/scheme-proposals/stream") {
      return handleSchemeProposalStream(req, res);
    }

    if (req.method === "POST" && url === "/api/ai/agent/run") {
      return handleAgentRun(req, res);
    }

    setCors(resp);
    resp.setStatusCode(404);
    resp.setHeader("Content-Type", "application/json; charset=utf-8");
    resp.send(JSON.stringify({ error: "Not found" }));
  } catch (err) {
    setCors(resp);
    resp.setStatusCode(500);
    resp.setHeader("Content-Type", "application/json; charset=utf-8");
    resp.send(JSON.stringify({ error: "Bootstrap failed", details: err.message }));
  }
};

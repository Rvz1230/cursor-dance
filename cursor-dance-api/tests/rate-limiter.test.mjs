import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  acquireSlot,
  configureRateLimiter,
  releaseSlot,
} from "../src/rate-limiter.mjs";

function request(remoteAddress, forwardedFor) {
  return {
    headers: forwardedFor ? { "x-forwarded-for": forwardedFor } : {},
    socket: { remoteAddress },
  };
}

const TEST_ENV = {
  CURSORDANCE_AI_RPM_IP: "3",
  CURSORDANCE_AI_RPH_IP: "20",
  CURSORDANCE_AI_RPM_IP_AGENT: "1",
  CURSORDANCE_AI_RPH_IP_AGENT: "5",
};

describe("rate limiter isolation", () => {
  it("keeps quick and agent request windows independent", () => {
    configureRateLimiter(TEST_ENV);
    const client = request("127.0.0.1");

    assert.deepEqual(acquireSlot(client, "quick"), { ok: true });
    releaseSlot("quick");
    assert.deepEqual(acquireSlot(client, "agent"), { ok: true });
    releaseSlot("agent");
  });

  it("actually resets counters when reconfigured", () => {
    configureRateLimiter(TEST_ENV);
    const client = request("127.0.0.2");
    assert.deepEqual(acquireSlot(client, "agent"), { ok: true });
    releaseSlot("agent");
    assert.equal(acquireSlot(client, "agent").ok, false);

    configureRateLimiter(TEST_ENV);
    assert.deepEqual(acquireSlot(client, "agent"), { ok: true });
    releaseSlot("agent");
  });

  it("ignores spoofable forwarding headers unless proxy trust is explicit", () => {
    configureRateLimiter({ ...TEST_ENV, CURSORDANCE_AI_RPM_IP_AGENT: "1" });
    const first = request("203.0.113.10", "198.51.100.1");
    const second = request("203.0.113.10", "198.51.100.2");
    assert.deepEqual(acquireSlot(first, "agent"), { ok: true });
    releaseSlot("agent");
    assert.equal(acquireSlot(second, "agent").ok, false);

    configureRateLimiter({
      ...TEST_ENV,
      CURSORDANCE_AI_RPM_IP_AGENT: "1",
      CURSORDANCE_AI_TRUST_PROXY: "1",
    });
    assert.deepEqual(acquireSlot(first, "agent"), { ok: true });
    releaseSlot("agent");
    assert.deepEqual(acquireSlot(second, "agent"), { ok: true });
    releaseSlot("agent");
  });
});

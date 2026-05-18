import { describe, it, expect } from "vitest";
import { signRequest } from "../src/client/auth.js";

describe("signRequest", () => {
  const apiKey = "test-api-key";
  const secretKey = "test-secret-key";
  const timestamp = "1700000000000";

  it("returns correct headers with API key and timestamp", async () => {
    const headers = await signRequest({
      apiKey,
      secretKey,
      method: "GET",
      path: "/v1/data/price?symbol=BTC&type=crypto",
      timestamp,
    });

    expect(headers["X-API-Key"]).toBe(apiKey);
    expect(headers["X-Timestamp"]).toBe(timestamp);
    expect(headers["X-Signature"]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces deterministic signature for known inputs", async () => {
    const headers1 = await signRequest({
      apiKey,
      secretKey,
      method: "GET",
      path: "/v1/data/price?symbol=BTC&type=crypto",
      timestamp,
    });

    const headers2 = await signRequest({
      apiKey,
      secretKey,
      method: "GET",
      path: "/v1/data/price?symbol=BTC&type=crypto",
      timestamp,
    });

    expect(headers1["X-Signature"]).toBe(headers2["X-Signature"]);
  });

  it("changes signature when method differs", async () => {
    const get = await signRequest({
      apiKey,
      secretKey,
      method: "GET",
      path: "/v1/data/price",
      timestamp,
    });

    const post = await signRequest({
      apiKey,
      secretKey,
      method: "POST",
      path: "/v1/data/price",
      body: "{}",
      timestamp,
    });

    expect(get["X-Signature"]).not.toBe(post["X-Signature"]);
  });

  it("uppercases method in signature computation", async () => {
    const lower = await signRequest({
      apiKey,
      secretKey,
      method: "get",
      path: "/v1/data/price",
      timestamp,
    });

    const upper = await signRequest({
      apiKey,
      secretKey,
      method: "GET",
      path: "/v1/data/price",
      timestamp,
    });

    expect(lower["X-Signature"]).toBe(upper["X-Signature"]);
  });

  it("includes body in signature for POST requests", async () => {
    const withBody = await signRequest({
      apiKey,
      secretKey,
      method: "POST",
      path: "/v1/data/price",
      body: '{"symbol":"BTC"}',
      timestamp,
    });

    const withoutBody = await signRequest({
      apiKey,
      secretKey,
      method: "POST",
      path: "/v1/data/price",
      timestamp,
    });

    expect(withBody["X-Signature"]).not.toBe(withoutBody["X-Signature"]);
  });

  it("uses empty string as body default for GET", async () => {
    const explicit = await signRequest({
      apiKey,
      secretKey,
      method: "GET",
      path: "/v1/data/price",
      body: "",
      timestamp,
    });

    const implicit = await signRequest({
      apiKey,
      secretKey,
      method: "GET",
      path: "/v1/data/price",
      timestamp,
    });

    expect(explicit["X-Signature"]).toBe(implicit["X-Signature"]);
  });
});

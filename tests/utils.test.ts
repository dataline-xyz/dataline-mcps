import { describe, it, expect } from "vitest";
import { compactForAgent, isDatalineError } from "../src/mcp/utils.js";

describe("compactForAgent", () => {
  it("strips provider noise fields", () => {
    const input = {
      base: "BTC",
      average_price: 80000,
      endpoint: "/api/v1/data/price",
      latency_ms: 42,
      cache_hit: true,
    };
    const result = JSON.parse(compactForAgent(input));
    expect(result).toEqual({ base: "BTC", average_price: 80000 });
    expect(result).not.toHaveProperty("endpoint");
    expect(result).not.toHaveProperty("latency_ms");
    expect(result).not.toHaveProperty("cache_hit");
  });

  it("strips noise fields from nested objects", () => {
    const input = {
      data: {
        price: 100,
        endpoint: "/nested",
        latency_ms: 5,
      },
    };
    const result = JSON.parse(compactForAgent(input));
    expect(result).toEqual({ data: { price: 100 } });
  });

  it("strips noise fields from arrays of objects", () => {
    const input = [
      { exchange: "binance", price: 80000, cache_hit: false },
      { exchange: "okx", price: 80001, latency_ms: 10 },
    ];
    const result = JSON.parse(compactForAgent(input));
    expect(result).toEqual([
      { exchange: "binance", price: 80000 },
      { exchange: "okx", price: 80001 },
    ]);
  });

  it("drops null and undefined values", () => {
    const input = {
      base: "ETH",
      quote: null,
      kind: undefined,
      price: 3200,
    };
    const result = JSON.parse(compactForAgent(input));
    expect(result).toEqual({ base: "ETH", price: 3200 });
  });

  it("drops empty arrays and objects", () => {
    const input = {
      name: "test",
      sources: [],
      metadata: {},
      nested: { empty: [], also_empty: {} },
    };
    const result = JSON.parse(compactForAgent(input));
    expect(result).toEqual({ name: "test" });
  });

  it("filters null items from arrays", () => {
    const input = [null, { price: 100 }, undefined, null];
    const result = JSON.parse(compactForAgent(input));
    expect(result).toEqual([{ price: 100 }]);
  });

  it("returns compact JSON without indentation", () => {
    const input = { a: 1, b: 2 };
    const result = compactForAgent(input);
    expect(result).toBe('{"a":1,"b":2}');
    expect(result).not.toContain("\n");
  });

  it("handles primitives", () => {
    expect(compactForAgent(42)).toBe("42");
    expect(compactForAgent("hello")).toBe('"hello"');
    expect(compactForAgent(true)).toBe("true");
  });
});

describe("isDatalineError", () => {
  it("returns true for DatalineError objects", () => {
    expect(
      isDatalineError({
        error: true,
        code: "api_error",
        message: "fail",
        retryable: false,
      }),
    ).toBe(true);
  });

  it("returns false for regular data", () => {
    expect(isDatalineError({ base: "BTC", price: 80000 })).toBe(false);
    expect(isDatalineError(null)).toBe(false);
    expect(isDatalineError(42)).toBe(false);
    expect(isDatalineError("string")).toBe(false);
  });

  it("returns false for objects with error: false", () => {
    expect(
      isDatalineError({ error: false, code: "api_error", message: "x" }),
    ).toBe(false);
  });
});

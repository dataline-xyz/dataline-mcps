import { describe, it, expect } from "vitest";
import {
  EventDetailResponseSchema,
  EventMarketItemSchema,
  EventOutcomeSchema,
} from "../types.js";

describe("EventDetailResponseSchema", () => {
  const realBackendPayload = {
    provider: "polymarket",
    event_id: "231398",
    title: "Bitcoin Up or Down on May 16?",
    rules: [{ rules_primary: "Resolves based on...", rules_secondary: "" }],
    open_time: "1772078083.000000",
    close_time: "1772164200.000000",
    volume: 118660.56,
    volume_24h: 0.0,
    summary_data: { some: "data" },
    url: "https://polymarket.com/event/test",
    markets: {
      polymarket: [
        { id: "1441726", title: "", sub_title: null, rules: {} },
        { id: "1441727", title: "Alt market", sub_title: "sub" },
      ],
    },
    is_merged: false,
    is_active: true,
    outcomes: [
      { name: "Up", probability: 1.0, sources: [], method: "single_source" },
      { name: "Down", probability: 0.0, sources: [], method: "single_source" },
    ],
  };

  it("parses real backend response with string timestamps and dict markets", () => {
    const result = EventDetailResponseSchema.parse(realBackendPayload);
    expect(result.open_time).toBe("1772078083.000000");
    expect(result.close_time).toBe("1772164200.000000");
    expect(result.markets).toBeDefined();
    expect(result.markets!["polymarket"]).toHaveLength(2);
    expect(result.markets!["polymarket"][0].id).toBe("1441726");
    expect(result.outcomes).toHaveLength(2);
    expect(result.outcomes![0].name).toBe("Up");
    expect(result.outcomes![0].probability).toBe(1.0);
  });

  it("accepts multi-platform markets dict", () => {
    const payload = {
      ...realBackendPayload,
      markets: {
        polymarket: [{ id: "1", title: "pm1" }],
        kalshi: [{ id: "2", title: "k1" }, { id: "3", title: "k2" }],
      },
    };
    const result = EventDetailResponseSchema.parse(payload);
    expect(Object.keys(result.markets!)).toEqual(["polymarket", "kalshi"]);
    expect(result.markets!["kalshi"]).toHaveLength(2);
  });

  it("accepts missing optional fields", () => {
    const minimal = { title: "Minimal Event", is_active: true };
    const result = EventDetailResponseSchema.parse(minimal);
    expect(result.title).toBe("Minimal Event");
    expect(result.markets).toBeUndefined();
    expect(result.outcomes).toBeUndefined();
  });

  it("passes through unknown fields via passthrough", () => {
    const payload = { ...realBackendPayload, extra_field: "hello" };
    const result = EventDetailResponseSchema.parse(payload);
    expect((result as Record<string, unknown>).extra_field).toBe("hello");
  });
});

describe("EventMarketItemSchema", () => {
  it("parses with passthrough for extra fields", () => {
    const item = { id: "123", title: "test", sub_title: null, rules: { r: 1 }, extra: true };
    const result = EventMarketItemSchema.parse(item);
    expect(result.id).toBe("123");
    expect((result as Record<string, unknown>).rules).toEqual({ r: 1 });
  });
});

describe("EventOutcomeSchema", () => {
  it("parses outcome with all fields", () => {
    const outcome = { name: "Yes", probability: 0.65, sources: [{ s: 1 }], method: "weighted" };
    const result = EventOutcomeSchema.parse(outcome);
    expect(result.name).toBe("Yes");
    expect(result.probability).toBe(0.65);
  });

  it("accepts null probability", () => {
    const outcome = { name: "No", probability: null };
    const result = EventOutcomeSchema.parse(outcome);
    expect(result.probability).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { DatalineClient } from "../dataline.js";

describe("getPredictionMarketQuote", () => {
  let client: DatalineClient;

  beforeEach(() => {
    client = new DatalineClient({
      apiKey: "test-key",
      secretKey: "test-secret",
      baseUrl: "https://example.com",
    });
  });

  it("returns null fields when orderbook is empty (closed market)", async () => {
    vi.spyOn(client, "getOddsEventOrderbook").mockResolvedValue({});

    const result = (await client.getPredictionMarketQuote({
      platform: "polymarket",
      marketId: "closed-market-123",
      outcome: "yes",
    })) as Record<string, unknown>;

    expect(result.best_bid).toBeNull();
    expect(result.best_ask).toBeNull();
    expect(result.mid).toBeNull();
    expect(result.spread).toBeNull();
    expect(result.implied_probability_pct).toBeNull();
    expect(result.note).toContain("No orderbook data");
    expect(result.bids).toEqual([]);
    expect(result.asks).toEqual([]);
  });

  it("computes quote from valid orderbook", async () => {
    vi.spyOn(client, "getOddsEventOrderbook").mockResolvedValue({
      tick_size: 0.01,
      bids: [
        { price: 0.55, size: 100 },
        { price: 0.54, size: 200 },
      ],
      asks: [
        { price: 0.57, size: 150 },
        { price: 0.58, size: 300 },
      ],
    });

    const result = (await client.getPredictionMarketQuote({
      platform: "polymarket",
      marketId: "active-market-456",
      outcome: "yes",
      depth: 2,
    })) as Record<string, unknown>;

    expect(result.best_bid).toBe(0.55);
    expect(result.best_ask).toBe(0.57);
    expect(result.mid).toBe(0.56);
    expect(result.spread).toBeCloseTo(0.02);
    expect(result.implied_probability_pct).toBe(56);
    expect((result.bids as unknown[]).length).toBe(2);
    expect((result.asks as unknown[]).length).toBe(2);
  });

  it("propagates DatalineError from orderbook", async () => {
    vi.spyOn(client, "getOddsEventOrderbook").mockResolvedValue({
      error: true,
      code: "api_error",
      message: "Polymarket MarketId Closed.",
      retryable: false,
    });

    const result = (await client.getPredictionMarketQuote({
      platform: "polymarket",
      marketId: "error-market",
      outcome: "no",
    })) as Record<string, unknown>;

    expect(result.error).toBe(true);
    expect(result.code).toBe("api_error");
  });
});

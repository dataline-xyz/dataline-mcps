import { describe, it, expect, vi, beforeEach } from "vitest";
import { DatalineClient } from "../src/client/dataline.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("DatalineClient", () => {
  const client = new DatalineClient({
    apiKey: "test-key",
    secretKey: "test-secret",
    baseUrl: "http://localhost:8000",
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("getPrice", () => {
    it("returns parsed price data", async () => {
      const mockResponse = {
        code: 0,
        msg: "Success",
        data: {
          base: "BTC",
          quote: null,
          average_price: 80759.17,
          success_count: 4,
          sources: [
            { exchange: "okx", symbol: "BTC/USDT", price: 80763.4, timestamp: 1700000000000 },
            { exchange: "binance", symbol: "BTC/USDT", price: 80755.0, timestamp: 1700000000000 },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getPrice("BTC");

      expect(result.base).toBe("BTC");
      expect(result.average_price).toBe(80759.17);
      expect(result.success_count).toBe(4);
      expect(result.sources).toHaveLength(2);
      expect(result.sources[0].exchange).toBe("okx");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/data/price?base_currency=BTC"),
        expect.objectContaining({ method: "GET" })
      );
    });

    it("sends optional params", async () => {
      const mockResponse = {
        code: 0,
        msg: "Success",
        data: {
          base: "ETH",
          quote: "USDT",
          average_price: 3200.5,
          success_count: 3,
          sources: [],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await client.getPrice("ETH", "USDT", "perp");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("base_currency=ETH"),
        expect.anything()
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("quote_currency=USDT"),
        expect.anything()
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("kind=perp"),
        expect.anything()
      );
    });

    it("returns DatalineError on 401", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "Invalid signature",
      });

      const result = await client.getPrice("BTC");
      expect(result).toMatchObject({
        error: true,
        code: "auth_failed",
        message: "Invalid signature",
        status: 401,
        retryable: false,
      });
    });

    it("returns DatalineError on 500", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "something broke",
      });

      const result = await client.getPrice("BTC");
      expect(result).toMatchObject({
        error: true,
        code: "api_error",
        message: "something broke",
        status: 500,
        retryable: true,
      });
    });

    it("returns DatalineError on timeout", async () => {
      const timeoutClient = new DatalineClient({
        apiKey: "test-key",
        secretKey: "test-secret",
        baseUrl: "http://localhost:8000",
        timeoutMs: 1,
      });

      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => {
              const err = new Error("The operation was aborted");
              err.name = "AbortError";
              reject(err);
            }, 10);
          }),
      );

      const result = await timeoutClient.getPrice("BTC");
      expect(result).toMatchObject({
        error: true,
        code: "dataline_api_timeout",
        retryable: true,
      });
    });

    it("returns DatalineError when fetch fails", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

      const result = await client.getPrice("BTC");
      expect(result).toMatchObject({
        error: true,
        code: "dataline_api_unreachable",
        retryable: false,
      });
    });
  });

  describe("getFundingRate", () => {
    it("returns parsed funding rate data", async () => {
      const mockResponse = {
        code: 0,
        msg: "Success",
        data: {
          base: "ETH",
          quote: null,
          sources: [
            {
              exchange: "binance",
              symbol: "ETHUSDT",
              sub_type: "linear",
              funding_rate: 0.0001,
              timestamp: 1700000000000,
              funding_timestamp: 1700000000000,
              next_funding_timestamp: 1700003600000,
            },
            {
              exchange: "bybit",
              symbol: "ETHUSDT",
              sub_type: "linear",
              funding_rate: 0.00012,
              timestamp: 1700000000000,
              funding_timestamp: 1700000000000,
              next_funding_timestamp: null,
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getFundingRate("ETH");

      expect(result.base).toBe("ETH");
      expect(result.sources).toHaveLength(2);
      expect(result.sources[0].funding_rate).toBe(0.0001);
      expect(result.sources[0].sub_type).toBe("linear");
      expect(result.sources[0].funding_timestamp).toBe(1700000000000);
      expect(result.sources[0].next_funding_timestamp).toBe(1700003600000);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/data/funding_rate?base_currency=ETH"),
        expect.anything()
      );
    });
  });

  describe("searchOddsEvents", () => {
    it("returns parsed event list", async () => {
      const mockResponse = {
        code: 0,
        msg: "Success",
        data: [
          {
            provider: "polymarket",
            event_id: "evt-1",
            title: "Bitcoin 100k by end of year",
            volume: null,
            volume_24h: null,
            open_time: 1772078083,
            close_time: 1772164200,
            is_merged: false,
            is_active: true,
            kalshi_event_id: null,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.searchOddsEvents({ query: "bitcoin" });

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Bitcoin 100k by end of year");
      expect(result[0].provider).toBe("polymarket");
      expect(result[0].event_id).toBe("evt-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/data/odds/event/search?query=bitcoin"),
        expect.anything()
      );
    });

    it("passes status and sort query params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 0, msg: "Success", data: [] }),
      });

      await client.searchOddsEvents({ query: "bitcoin", status: "all", sort: "volume" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("status=all"),
        expect.anything()
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("sort=volume"),
        expect.anything()
      );
    });
  });

  describe("getOddsEventDetail", () => {
    it("returns parsed event detail", async () => {
      const mockResponse = {
        code: 0,
        msg: "Success",
        data: {
          provider: "polymarket",
          event_id: "evt-1",
          title: "2024 US Election",
          is_active: true,
          rules: [{ rules_primary: "Who will win?", rules_secondary: "" }],
          close_time: "1772164200.000000",
          open_time: "1772078083.000000",
          markets: {
            polymarket: [
              { id: "mkt-1", title: "Winner?" },
            ],
          },
          outcomes: [{ name: "A", probability: 0.55, sources: [], method: "single_source" }],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getOddsEventDetail({
        provider: "polymarket",
        eventId: "evt-1",
      });

      expect(result.title).toBe("2024 US Election");
      expect(result.close_time).toBe("1772164200.000000");
      expect(result.markets!["polymarket"]).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/data/odds/event/detail?provider=polymarket&event_id=evt-1"),
        expect.anything()
      );
    });
  });

  describe("getOddsCategories", () => {
    it("returns category list", async () => {
      const mockResponse = {
        code: 0,
        msg: "Success",
        data: ["crypto", "politics", "sports"],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getOddsCategories();

      expect(result).toEqual(["crypto", "politics", "sports"]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/data/odds/category/list"),
        expect.anything()
      );
    });
  });

  describe("getOddsEventList", () => {
    it("passes status, sort, and cursor query params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 0, msg: "Success", data: [] }),
      });

      await client.getOddsEventList({
        category: "crypto",
        status: "closed",
        sort: "open_interest",
        cursor: "abc123",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("status=closed"),
        expect.anything()
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("sort=open_interest"),
        expect.anything()
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("cursor=abc123"),
        expect.anything()
      );
    });
  });

  describe("getOddsEventOrderbook", () => {
    it("returns orderbook data", async () => {
      const mockResponse = {
        code: 0,
        msg: "Success",
        data: { tick_size: 0.01, bids: [[0.6, 100]], asks: [[0.61, 50]] },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getOddsEventOrderbook({ polymarketMarketId: "abc123" });

      expect(result.tick_size).toBe(0.01);
      expect(result.bids).toEqual([[0.6, 100]]);
      expect(result.asks).toEqual([[0.61, 50]]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/data/odds/event/market/orderbook"),
        expect.anything()
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("polymarket_market_id=abc123"),
        expect.anything()
      );
    });
  });

  describe("getPredictionMarketQuote", () => {
    it("computes quote from orderbook with object-style levels", async () => {
      const mockResponse = {
        code: 0,
        msg: "Success",
        data: {
          tick_size: 0.01,
          bids: [
            { price: 0.60, size: 100, provider: "Polymarket" },
            { price: 0.58, size: 200, provider: "Polymarket" },
          ],
          asks: [
            { price: 0.65, size: 50, provider: "Polymarket" },
            { price: 0.67, size: 80, provider: "Polymarket" },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getPredictionMarketQuote({
        platform: "polymarket",
        marketId: "mkt-1",
        outcome: "yes",
        side: "buy",
        depth: 5,
      }) as Record<string, unknown>;

      expect(result.platform).toBe("polymarket");
      expect(result.market_id).toBe("mkt-1");
      expect(result.outcome).toBe("yes");
      expect(result.best_bid).toBe(0.60);
      expect(result.best_ask).toBe(0.65);
      expect(result.mid).toBe(0.625);
      expect(result.spread).toBeCloseTo(0.05);
      expect(result.implied_probability_pct).toBe(62.5);
    });
  });

  describe("EventResponse schema — derived time_to_close_seconds", () => {
    it("derives time_to_close_seconds for future close_time", async () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 100000;
      const mockResponse = {
        code: 0,
        msg: "Success",
        data: [
          {
            provider: "polymarket",
            event_id: "231398",
            title: "Bitcoin Up or Down...",
            volume: null,
            volume_24h: null,
            open_time: 1772078083,
            close_time: futureTimestamp,
            is_merged: false,
            is_active: true,
            kalshi_event_id: null,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.searchOddsEvents({ query: "bitcoin" });
      const events = result as Array<{ time_to_close_seconds?: number | null }>;
      expect(events[0].time_to_close_seconds).toBeGreaterThan(0);
    });

    it("sets time_to_close_seconds to 0 for past close_time", async () => {
      const pastTimestamp = Math.floor(Date.now() / 1000) - 10000;
      const mockResponse = {
        code: 0,
        msg: "Success",
        data: [
          {
            provider: "kalshi",
            event_id: "evt-past",
            title: "Past Event",
            is_active: false,
            close_time: pastTimestamp,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.searchOddsEvents({ query: "past" });
      const events = result as Array<{ time_to_close_seconds?: number | null }>;
      expect(events[0].time_to_close_seconds).toBe(0);
    });
  });

  describe("backend business error (non-zero code)", () => {
    it("returns api_error with backend message when code is non-zero", async () => {
      const mockResponse = {
        code: 1005,
        msg: "Invalid ticker symbol",
        data: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getPrice("XXXXNOTREAL");
      expect(result).toMatchObject({
        error: true,
        code: "api_error",
        message: "Invalid ticker symbol (code: 1005)",
        status: 200,
        retryable: false,
      });
    });

    it("falls through to schema.parse when code is 0", async () => {
      const mockResponse = {
        code: 0,
        msg: "Success",
        data: {
          base: "BTC",
          quote: null,
          average_price: 90000,
          success_count: 1,
          sources: [],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getPrice("BTC");
      expect(result).toMatchObject({ base: "BTC", average_price: 90000 });
    });
  });

  describe("ZodError handling", () => {
    it("returns response_validation_error when backend returns unexpected schema", async () => {
      const mockResponse = {
        code: 0,
        msg: "Success",
        data: {
          base: "BTC",
          quote: "USDT",
          average_price: "not-a-number",
          success_count: 1,
          sources: [],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getPrice("BTC");
      expect(result).toMatchObject({
        error: true,
        code: "response_validation_error",
        retryable: false,
      });
    });
  });
});

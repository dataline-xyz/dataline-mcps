import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DatalineClient } from "../src/client/dataline.js";
import { createTools } from "../src/mcp/server.js";

async function setupTestHarness(client: DatalineClient) {
  const server = new McpServer({ name: "dataline-test", version: "1.0.0" });
  createTools(server, client);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
  await server.connect(serverTransport);
  await mcpClient.connect(clientTransport);
  return { mcpClient, server };
}

describe("MCP Server Tools", () => {
  let mockClient: DatalineClient;

  beforeEach(() => {
    mockClient = {
      getPrice: vi.fn(),
      getFundingRate: vi.fn(),
      searchOddsEvents: vi.fn(),
      getOddsEventDetail: vi.fn(),
      getOddsCategories: vi.fn(),
      getOddsEventList: vi.fn(),
      getOddsEventOrderbook: vi.fn(),
      getPredictionMarketQuote: vi.fn(),
    } as unknown as DatalineClient;
  });

  it("get_price returns formatted JSON", async () => {
    const priceData = {
      base: "BTC",
      quote: null,
      average_price: 80759.17,
      success_count: 4,
      sources: [
        { exchange: "okx", symbol: "BTC/USDT", price: 80763.4, timestamp: 1700000000000 },
      ],
    };
    vi.mocked(mockClient.getPrice).mockResolvedValue(priceData);

    const { mcpClient } = await setupTestHarness(mockClient);
    const result = await mcpClient.callTool({
      name: "get_price",
      arguments: { base_currency: "BTC" },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].type).toBe("text");
    const parsed = JSON.parse(content[0].text);
    expect(parsed.base).toBe("BTC");
    expect(parsed.average_price).toBe(80759.17);
    expect(parsed.sources[0].exchange).toBe("okx");
    expect(mockClient.getPrice).toHaveBeenCalledWith("BTC", undefined);
  });

  it("get_funding_rate returns formatted JSON", async () => {
    const fundingData = {
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
      ],
    };
    vi.mocked(mockClient.getFundingRate).mockResolvedValue(fundingData);

    const { mcpClient } = await setupTestHarness(mockClient);
    const result = await mcpClient.callTool({
      name: "get_funding_rate",
      arguments: { base_currency: "ETH" },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.base).toBe("ETH");
    expect(parsed.sources[0].funding_rate).toBe(0.0001);
    expect(mockClient.getFundingRate).toHaveBeenCalledWith("ETH", undefined);
  });

  it("search_prediction_events returns formatted JSON", async () => {
    const eventsData = [
      {
        provider: "polymarket" as const,
        event_id: "evt-1",
        title: "Bitcoin 100k",
        is_active: true,
        volume: null,
        volume_24h: null,
        open_time: 1772078083,
        close_time: 1772164200,
        is_merged: false,
        kalshi_event_id: null,
      },
    ];
    vi.mocked(mockClient.searchOddsEvents).mockResolvedValue(eventsData);

    const { mcpClient } = await setupTestHarness(mockClient);
    const result = await mcpClient.callTool({
      name: "search_prediction_events",
      arguments: { query: "bitcoin" },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed[0].title).toBe("Bitcoin 100k");
    expect(parsed[0].event_id).toBe("evt-1");
    expect(mockClient.searchOddsEvents).toHaveBeenCalledWith({
      query: "bitcoin",
      page: undefined,
      limit: undefined,
    });
  });

  it("get_prediction_event_detail wraps response with markets metadata", async () => {
    const detailData = {
      provider: "polymarket" as const,
      event_id: "evt-1",
      title: "2024 Election",
      is_active: true,
      description: "Who wins?",
      markets: [],
    };
    vi.mocked(mockClient.getOddsEventDetail).mockResolvedValue(detailData);

    const { mcpClient } = await setupTestHarness(mockClient);
    const result = await mcpClient.callTool({
      name: "get_prediction_event_detail",
      arguments: { provider: "polymarket", event_id: "evt-1" },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.title).toBe("2024 Election");
    expect(parsed.total_markets).toBe(0);
    expect(parsed.markets_truncated).toBe(false);
  });

  it("get_odds_categories returns list", async () => {
    vi.mocked(mockClient.getOddsCategories).mockResolvedValue(["crypto", "politics"]);

    const { mcpClient } = await setupTestHarness(mockClient);
    const result = await mcpClient.callTool({
      name: "get_odds_categories",
      arguments: {},
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed).toEqual(["crypto", "politics"]);
  });

  it("get_odds_event_list passes filters", async () => {
    const eventsData = [
      { provider: "polymarket" as const, event_id: "evt-1", title: "Test", is_active: true },
    ];
    vi.mocked(mockClient.getOddsEventList).mockResolvedValue(eventsData);

    const { mcpClient } = await setupTestHarness(mockClient);
    const result = await mcpClient.callTool({
      name: "get_odds_event_list",
      arguments: { category: "crypto" },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed[0].title).toBe("Test");
    expect(mockClient.getOddsEventList).toHaveBeenCalledWith({
      category: "crypto",
      isActive: undefined,
      page: undefined,
      limit: undefined,
      platform: undefined,
    });
  });

  it("get_odds_event_orderbook returns raw orderbook", async () => {
    const orderbookData = { tick_size: 0.01, bids: [[0.6, 100]], asks: [[0.61, 50]] };
    vi.mocked(mockClient.getOddsEventOrderbook).mockResolvedValue(orderbookData);

    const { mcpClient } = await setupTestHarness(mockClient);
    const result = await mcpClient.callTool({
      name: "get_odds_event_orderbook",
      arguments: { polymarket_market_id: "mkt-1" },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.tick_size).toBe(0.01);
    expect(mockClient.getOddsEventOrderbook).toHaveBeenCalledWith({
      kalshiMarketId: undefined,
      polymarketMarketId: "mkt-1",
    });
  });

  it("get_price surfaces structured error", async () => {
    vi.mocked(mockClient.getPrice).mockResolvedValue({
      error: true as const,
      code: "api_error",
      message: "service unavailable",
      status: 503,
      retryable: true,
    });

    const { mcpClient } = await setupTestHarness(mockClient);
    const result = await mcpClient.callTool({
      name: "get_price",
      arguments: { base_currency: "BTC" },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.error).toBe(true);
    expect(parsed.code).toBe("api_error");
    expect(parsed.retryable).toBe(true);
  });

  it("get_price normalizes currency to uppercase", async () => {
    vi.mocked(mockClient.getPrice).mockResolvedValue({
      base: "BTC",
      quote: "USDT",
      average_price: 80000,
      success_count: 1,
      sources: [],
    });

    const { mcpClient } = await setupTestHarness(mockClient);
    await mcpClient.callTool({
      name: "get_price",
      arguments: { base_currency: "btc", quote_currency: "usdt" },
    });

    expect(mockClient.getPrice).toHaveBeenCalledWith("BTC", "USDT");
  });

  it("get_prediction_event_detail rejects empty event_id", async () => {
    const { mcpClient } = await setupTestHarness(mockClient);
    const result = await mcpClient.callTool({
      name: "get_prediction_event_detail",
      arguments: { provider: "polymarket", event_id: "   " },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.error).toBe(true);
    expect(parsed.code).toBe("invalid_input");
    expect(parsed.field).toBe("event_id");
    expect(mockClient.getOddsEventDetail).not.toHaveBeenCalled();
  });

  it("get_odds_event_orderbook requires at least one market id", async () => {
    const { mcpClient } = await setupTestHarness(mockClient);
    const result = await mcpClient.callTool({
      name: "get_odds_event_orderbook",
      arguments: {},
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.error).toBe(true);
    expect(parsed.code).toBe("invalid_input");
    expect(mockClient.getOddsEventOrderbook).not.toHaveBeenCalled();
  });

  it("get_prediction_market_quote returns quote", async () => {
    const quoteData = {
      best_bid: 0.62,
      best_ask: 0.65,
      mid: 0.635,
      spread: 0.03,
      implied_probability_pct: 63.5,
    };
    vi.mocked(mockClient.getPredictionMarketQuote).mockResolvedValue(quoteData);

    const { mcpClient } = await setupTestHarness(mockClient);
    const result = await mcpClient.callTool({
      name: "get_prediction_market_quote",
      arguments: { platform: "polymarket", market_id: "mkt-1", outcome: "yes" },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.best_bid).toBe(0.62);
    expect(parsed.implied_probability_pct).toBe(63.5);
    expect(mockClient.getPredictionMarketQuote).toHaveBeenCalledWith({
      platform: "polymarket",
      marketId: "mkt-1",
      outcome: "yes",
      side: "buy",
      quoteNotional: undefined,
      depth: 5,
    });
  });

  it("get_prediction_event_detail truncates with markets_limit", async () => {
    const detailData = {
      provider: "polymarket" as const,
      event_id: "evt-big",
      title: "Big Event",
      is_active: true,
      markets: {
        polymarket: Array.from({ length: 5 }, (_, i) => ({
          id: `mkt-${i}`,
          title: `Q${i}`,
        })),
      },
      outcomes: [{ name: "Yes", probability: 0.5, sources: [], method: "single_source" }],
    };
    vi.mocked(mockClient.getOddsEventDetail).mockResolvedValue(detailData);

    const { mcpClient } = await setupTestHarness(mockClient);
    const result = await mcpClient.callTool({
      name: "get_prediction_event_detail",
      arguments: { provider: "polymarket", event_id: "evt-big", markets_limit: 2 },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.markets.polymarket).toHaveLength(2);
    expect(parsed.total_markets).toBe(5);
    expect(parsed.markets_truncated).toBe(true);
  });
});

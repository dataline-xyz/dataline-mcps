import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DatalineClient } from "../client/dataline.js";
import type { EventDetailResponse } from "../client/types.js";
import { compactForAgent, isDatalineError } from "./utils.js";

export function createTools(server: McpServer, client: DatalineClient) {
  server.tool(
    "get_price",
    "Get current spot price for a crypto asset. Provide base_currency (e.g. BTC) and optional quote_currency (default USDT). " +
    "Returns per-source prices from multiple exchanges and an average. " +
    "For perpetual futures data (funding rates), use get_funding_rate instead.",
    {
      base_currency: z
        .string()
        .describe("Base currency ticker, e.g. BTC, ETH, SOL"),
      quote_currency: z
        .string()
        .optional()
        .describe("Quote currency, e.g. USDT. Defaults to exchange default."),
    },
    async ({ base_currency, quote_currency }) => {
      const base = base_currency.toUpperCase();
      const quote = quote_currency?.toUpperCase();
      const data = await client.getPrice(base, quote);
      return {
        content: [{ type: "text" as const, text: compactForAgent(data) }],
      };
    },
  );

  server.tool(
    "get_funding_rate",
    "Get current funding rate for a perpetual futures contract. Returns per-venue funding rates with annualized rates and next funding timestamps. Supported venues: binance, bybit, okx.",
    {
      base_currency: z
        .string()
        .describe("Crypto ticker symbol, e.g. BTC, ETH"),
      quote_currency: z
        .string()
        .optional()
        .describe("Quote currency filter"),
    },
    async ({ base_currency, quote_currency }) => {
      const data = await client.getFundingRate(
        base_currency.toUpperCase(),
        quote_currency?.toUpperCase(),
      );
      return {
        content: [{ type: "text" as const, text: compactForAgent(data) }],
      };
    },
  );

  server.tool(
    "search_prediction_events",
    "Search prediction market events by keyword, slug, or ticker-like text on Polymarket and Kalshi. Returns matching events with markets and outcome probabilities. Query must be at least 3 characters. Use get_odds_event_list to browse without a keyword.",
    {
      query: z
        .string()
        .min(3)
        .describe("Search keyword, slug, or ticker. Min 3 characters."),
      page: z.number().optional().describe("Page number for pagination"),
      limit: z.number().optional().describe("Results per page"),
    },
    async ({ query, page, limit }) => {
      const data = await client.searchOddsEvents({ query, page, limit });
      return {
        content: [{ type: "text" as const, text: compactForAgent(data) }],
      };
    },
  );

  server.tool(
    "get_prediction_event_detail",
    "Get full details for one prediction market event: sub-markets, outcome probabilities, rules summary, and settlement timing. " +
    "WARNING: large events (e.g. election brackets) can have 100+ sub-markets and return very large responses. " +
    "Default markets_limit is 20. Increase only when you need full coverage.",
    {
      provider: z
        .enum(["polymarket", "kalshi"])
        .describe("Platform the event is on"),
      event_id: z.string().describe("Event ID from search results"),
      markets_limit: z.number().min(1).max(200).optional().default(20)
        .describe("Max number of sub-markets to include (default 20). Large events have 100+ markets."),
    },
    async ({ provider, event_id, markets_limit }) => {
      const trimmedId = event_id.trim();
      if (!trimmedId) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: true,
                code: "invalid_input",
                message: "event_id must not be empty",
                field: "event_id",
              }),
            },
          ],
        };
      }
      const data = await client.getOddsEventDetail({
        provider,
        eventId: trimmedId,
      });
      if (isDatalineError(data)) {
        return { content: [{ type: "text" as const, text: compactForAgent(data) }] };
      }
      const detail = data as EventDetailResponse;
      const marketsDict = detail.markets ?? {};
      const allMarkets = Object.values(marketsDict).flat();
      const total_markets = allMarkets.length;
      const limit = markets_limit ?? 20;
      const limitedMarkets: Record<string, unknown[]> = {};
      let count = 0;
      for (const [platform, mktList] of Object.entries(marketsDict)) {
        if (count >= limit) break;
        const sliced = mktList.slice(0, limit - count);
        if (sliced.length > 0) limitedMarkets[platform] = sliced;
        count += sliced.length;
      }
      const limited = {
        ...detail,
        markets: limitedMarkets,
        total_markets,
        markets_truncated: total_markets > limit,
      };
      return {
        content: [{ type: "text" as const, text: compactForAgent(limited) }],
      };
    },
  );

  server.tool(
    "get_odds_categories",
    "List all available prediction market event categories (e.g. crypto, politics, sports). Returns an array of category name strings. Use these values as the category filter in get_odds_event_list. No parameters required.",
    {},
    async () => {
      const data = await client.getOddsCategories();
      return {
        content: [{ type: "text" as const, text: compactForAgent(data) }],
      };
    },
  );

  server.tool(
    "get_odds_event_list",
    "List prediction market events, optionally filtered by category and platform. Returns events with markets and outcome probabilities. Use get_odds_categories to discover valid category values.",
    {
      category: z
        .string()
        .optional()
        .describe("Category filter e.g. crypto, politics, sports. Use get_odds_categories to list valid values."),
      is_active: z.boolean().optional()
        .describe("Filter by active status: true = open/active events only, false = closed events only, omit for all."),
      page: z.number().optional().describe("Page number for pagination"),
      limit: z.number().optional().describe("Results per page (max 100)"),
      platform: z
        .enum(["polymarket", "kalshi"])
        .optional()
        .describe("Platform filter"),
    },
    async ({ category, is_active, page, limit, platform }) => {
      const data = await client.getOddsEventList({
        category,
        isActive: is_active,
        page,
        limit,
        platform,
      });
      return {
        content: [{ type: "text" as const, text: compactForAgent(data) }],
      };
    },
  );

  server.tool(
    "get_odds_event_orderbook",
    "Get the raw orderbook (bids and asks) for a specific prediction market outcome. Provide either kalshi_market_id OR polymarket_market_id (not both, at least one required). Returns raw bid/ask levels — use the best bid and ask to compute mid price and implied probability.",
    {
      kalshi_market_id: z
        .string()
        .optional()
        .describe("Kalshi market identifier"),
      polymarket_market_id: z
        .string()
        .optional()
        .describe("Polymarket market ID (condition ID or token ID)"),
    },
    async ({ kalshi_market_id, polymarket_market_id }) => {
      if (!kalshi_market_id && !polymarket_market_id) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: true,
                code: "invalid_input",
                message:
                  "At least one of kalshi_market_id or polymarket_market_id must be provided.",
              }),
            },
          ],
        };
      }
      const data = await client.getOddsEventOrderbook({
        kalshiMarketId: kalshi_market_id,
        polymarketMarketId: polymarket_market_id,
      });
      return {
        content: [{ type: "text" as const, text: compactForAgent(data) }],
      };
    },
  );

  server.tool(
    "get_prediction_market_quote",
    "Get a quote for a prediction market outcome computed from live orderbook data. " +
    "Returns best bid, best ask, mid price, spread, and implied probability percentage. " +
    "Outcome must be 'yes' or 'no'. Use market_id from get_prediction_event_detail results.",
    {
      platform: z.enum(["polymarket", "kalshi"]).describe("Prediction market platform"),
      market_id: z.string().describe("Market ID from event detail results"),
      outcome: z.enum(["yes", "no"]).describe("Outcome side to quote: 'yes' or 'no'"),
      side: z.enum(["buy", "sell"]).optional().default("buy").describe("Trade direction"),
      quote_notional: z.number().positive().optional().describe("Optional: trade size in USD for execution simulation"),
      depth: z.number().min(1).max(20).optional().default(5).describe("Orderbook depth levels to use (1-20)"),
    },
    async ({ platform, market_id, outcome, side, quote_notional, depth }) => {
      const data = await client.getPredictionMarketQuote({
        platform, marketId: market_id, outcome, side, quoteNotional: quote_notional, depth
      });
      return {
        content: [{ type: "text" as const, text: compactForAgent(data) }],
      };
    }
  );
}

async function main() {
  if (!process.env.DATALINE_API_KEY) {
    console.error(
      "[dataline-mcp] WARNING: DATALINE_API_KEY is not set — requests will fail with 401",
    );
  }
  if (!process.env.DATALINE_SECRET_KEY) {
    console.error(
      "[dataline-mcp] WARNING: DATALINE_SECRET_KEY is not set — requests will fail with 401",
    );
  }

  const timeoutMs = parseInt(
    process.env.DATALINE_MCP_TIMEOUT_MS ?? "45000",
    10,
  );

  const server = new McpServer({
    name: "dataline",
    version: "1.0.0",
  });
  const client = new DatalineClient({
    apiKey: process.env.DATALINE_API_KEY ?? "",
    secretKey: process.env.DATALINE_SECRET_KEY ?? "",
    baseUrl: process.env.DATALINE_BASE_URL ?? "https://www.dataline.xyz",
    timeoutMs,
  });
  createTools(server, client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Dataline MCP Server running on stdio");
}

main().catch(console.error);

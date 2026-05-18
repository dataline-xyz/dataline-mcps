import { ZodError } from "zod";
import { signRequest } from "./auth.js";
import {
  PriceDataResponseSchema,
  FundingRateDataResponseSchema,
  EventResponseSchema,
  EventDetailResponseSchema,
  ApiWrappedResponseSchema,
  type PriceDataResponse,
  type FundingRateDataResponse,
  type EventResponse,
  type EventDetailResponse,
  type PriceKind,
  type DatalineClientConfig,
  type DatalineError,
} from "./types.js";

function isDatalineError(data: unknown): data is DatalineError {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Record<string, unknown>).error === true
  );
}

function addDerivedFields(event: EventResponse): EventResponse {
  if (event.close_time != null && event.time_to_close_seconds === undefined) {
    const closeMs = event.close_time * 1000;
    const nowMs = Date.now();
    event.time_to_close_seconds = closeMs > nowMs ? Math.floor((closeMs - nowMs) / 1000) : 0;
  }
  return event;
}

export class DatalineClient {
  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: DatalineClientConfig) {
    this.apiKey = config.apiKey;
    this.secretKey = config.secretKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs ?? 45000;
  }

  async getPrice(
    baseCurrency: string,
    quoteCurrency?: string,
    kind?: PriceKind,
  ): Promise<PriceDataResponse | DatalineError> {
    const query = new URLSearchParams();
    query.set("base_currency", baseCurrency);
    if (quoteCurrency) query.set("quote_currency", quoteCurrency);
    if (kind) query.set("kind", kind);
    const path = `/api/v1/data/price?${query.toString()}`;
    return this.request("GET", path, PriceDataResponseSchema);
  }

  async getFundingRate(
    baseCurrency: string,
    quoteCurrency?: string,
    kind?: string,
  ): Promise<FundingRateDataResponse | DatalineError> {
    const query = new URLSearchParams();
    query.set("base_currency", baseCurrency);
    if (quoteCurrency) query.set("quote_currency", quoteCurrency);
    if (kind) query.set("kind", kind);
    const path = `/api/v1/data/funding_rate?${query.toString()}`;
    return this.request("GET", path, FundingRateDataResponseSchema);
  }

  async getOddsCategories(): Promise<string[] | DatalineError> {
    const path = `/api/v1/data/odds/category/list`;
    return this.request("GET", path, { parse: (d: unknown) => d as string[] });
  }

  async getOddsEventList(params: {
    category?: string;
    status?: "open" | "closed" | "settled" | "all";
    sort?: "volume" | "open_interest" | "liquidity" | "close_time";
    page?: number;
    limit?: number;
    platform?: "polymarket" | "kalshi";
    cursor?: string;
  }): Promise<EventResponse[] | DatalineError> {
    const query = new URLSearchParams();
    if (params.category) query.set("category", params.category);
    if (params.status) query.set("status", params.status);
    if (params.sort) query.set("sort", params.sort);
    if (params.page !== undefined) query.set("page", String(params.page));
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.platform) query.set("platform", params.platform);
    if (params.cursor) query.set("cursor", params.cursor);
    const qs = query.toString();
    const path = `/api/v1/data/odds/event/list${qs ? `?${qs}` : ""}`;
    return this.request("GET", path, {
      parse: (d: unknown) =>
        (d as unknown[]).map((e) => addDerivedFields(EventResponseSchema.parse(e))),
    });
  }

  async searchOddsEvents(params: {
    query: string;
    status?: "open" | "closed" | "settled" | "all";
    sort?: "relevance" | "volume" | "open_interest" | "close_time";
    page?: number;
    limit?: number;
  }): Promise<EventResponse[] | DatalineError> {
    const q = new URLSearchParams();
    q.set("query", params.query);
    if (params.status) q.set("status", params.status);
    if (params.sort) q.set("sort", params.sort);
    if (params.page !== undefined) q.set("page", String(params.page));
    if (params.limit !== undefined) q.set("limit", String(params.limit));
    const path = `/api/v1/data/odds/event/search?${q.toString()}`;
    return this.request("GET", path, {
      parse: (d: unknown) =>
        (d as unknown[]).map((e) => addDerivedFields(EventResponseSchema.parse(e))),
    });
  }

  async getOddsEventDetail(params: {
    provider: "polymarket" | "kalshi";
    eventId: string;
  }): Promise<EventDetailResponse | DatalineError> {
    const q = new URLSearchParams();
    q.set("provider", params.provider);
    q.set("event_id", params.eventId);
    const path = `/api/v1/data/odds/event/detail?${q.toString()}`;
    const result = await this.request("GET", path, EventDetailResponseSchema);
    if (!isDatalineError(result)) {
      if (result.close_time != null && result.time_to_close_seconds === undefined) {
        const closeMs = parseFloat(result.close_time) * 1000;
        const nowMs = Date.now();
        result.time_to_close_seconds = closeMs > nowMs ? Math.floor((closeMs - nowMs) / 1000) : 0;
      }
    }
    return result;
  }

  async getOddsEventOrderbook(params: {
    kalshiMarketId?: string;
    polymarketMarketId?: string;
  }): Promise<unknown | DatalineError> {
    const q = new URLSearchParams();
    if (params.kalshiMarketId)
      q.set("kalshi_market_id", params.kalshiMarketId);
    if (params.polymarketMarketId)
      q.set("polymarket_market_id", params.polymarketMarketId);
    const path = `/api/v1/data/odds/event/market/orderbook?${q.toString()}`;
    return this.request("GET", path, { parse: (d: unknown) => d });
  }

  async getPredictionMarketQuote(params: {
    platform: "polymarket" | "kalshi";
    marketId: string;
    outcome: "yes" | "no";
    side?: "buy" | "sell";
    quoteNotional?: number;
    depth?: number;
  }): Promise<unknown> {
    const obParams = params.platform === "polymarket"
      ? { polymarketMarketId: params.marketId }
      : { kalshiMarketId: params.marketId };

    const orderbook = await this.getOddsEventOrderbook(obParams);

    if (isDatalineError(orderbook)) {
      return orderbook;
    }

    const ob = orderbook as Record<string, unknown>;

    if (!ob.bids && !ob.asks) {
      return {
        platform: params.platform,
        market_id: params.marketId,
        outcome: params.outcome,
        best_bid: null,
        best_ask: null,
        mid: null,
        spread: null,
        implied_probability_pct: null,
        note: "No orderbook data available for this market (may be closed or inactive)",
        bids: [],
        asks: [],
      };
    }

    function extractLevels(levels: unknown): Array<{ price: number; size: number }> {
      if (!Array.isArray(levels)) return [];
      return levels
        .map((l: unknown) => {
          if (Array.isArray(l)) return { price: Number(l[0]), size: Number(l[1]) };
          if (typeof l === "object" && l !== null) {
            const obj = l as Record<string, unknown>;
            return { price: Number(obj.price ?? obj[0]), size: Number(obj.size ?? obj[1]) };
          }
          return { price: 0, size: 0 };
        })
        .filter((l) => !isNaN(l.price) && l.price > 0);
    }

    const bids = extractLevels(ob.bids);
    const asks = extractLevels(ob.asks);

    const depthLimit = params.depth ?? 5;
    const topBids = bids.sort((a, b) => b.price - a.price).slice(0, depthLimit);
    const topAsks = asks.sort((a, b) => a.price - b.price).slice(0, depthLimit);

    const bestBid = topBids[0]?.price ?? null;
    const bestAsk = topAsks[0]?.price ?? null;
    const mid = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : null;
    const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;
    const impliedProbabilityPct = mid !== null ? parseFloat((mid * 100).toFixed(2)) : null;

    return {
      platform: params.platform,
      market_id: params.marketId,
      outcome: params.outcome,
      side: params.side ?? "buy",
      best_bid: bestBid,
      best_ask: bestAsk,
      mid,
      spread,
      implied_probability_pct: impliedProbabilityPct,
      bids: topBids,
      asks: topAsks,
    };
  }

  private async request<T>(
    method: string,
    path: string,
    schema: { parse: (data: unknown) => T },
  ): Promise<T | DatalineError> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers = await signRequest({
        apiKey: this.apiKey,
        secretKey: this.secretKey,
        method,
        path,
      });
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { ...headers, "Content-Type": "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          error: true as const,
          code:
            res.status === 401 || res.status === 403
              ? "auth_failed"
              : "api_error",
          message: body || `HTTP ${res.status}`,
          status: res.status,
          retryable: res.status >= 500,
        };
      }
      const json = await res.json();
      const wrapped = ApiWrappedResponseSchema.parse(json);
      if (wrapped.code !== 0) {
        return {
          error: true as const,
          code: "api_error" as const,
          message: `${wrapped.msg || "Backend error"} (code: ${wrapped.code})`,
          status: res.status,
          retryable: false,
        };
      }
      try {
        return schema.parse(wrapped.data);
      } catch (zodErr) {
        if (zodErr instanceof ZodError) {
          return {
            error: true as const,
            code: "response_validation_error" as const,
            message: `Response schema mismatch: ${zodErr.message.slice(0, 300)}`,
            retryable: false,
          };
        }
        throw zodErr;
      }
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof ZodError) {
        return {
          error: true as const,
          code: "response_validation_error" as const,
          message: `Response schema mismatch: ${err.message.slice(0, 300)}`,
          retryable: false,
        };
      }
      if (err instanceof Error && err.name === "AbortError") {
        return {
          error: true as const,
          code: "dataline_api_timeout",
          message: "Dataline API did not respond in time.",
          retryable: true,
        };
      }
      return {
        error: true as const,
        code: "dataline_api_unreachable",
        message: `Cannot reach Dataline API: ${String(err)}`,
        retryable: false,
      };
    }
  }
}

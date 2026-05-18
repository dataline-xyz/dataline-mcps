import { z } from "zod";

export const PriceKind = z.enum(["spot", "perp"]);
export type PriceKind = z.infer<typeof PriceKind>;

export const PriceSourceSchema = z.object({
  exchange: z.string(),
  symbol: z.string(),
  price: z.number(),
  timestamp: z.number().nullable(),
});

export const PriceDataResponseSchema = z.object({
  base: z.string(),
  quote: z.string().nullable(),
  average_price: z.number(),
  success_count: z.number(),
  sources: z.array(PriceSourceSchema),
});
export type PriceDataResponse = z.infer<typeof PriceDataResponseSchema>;

export const FundingRateSourceSchema = z.object({
  exchange: z.string(),
  symbol: z.string(),
  sub_type: z.string().nullable(),
  funding_rate: z.number().nullable(),
  timestamp: z.number().nullable(),
  funding_timestamp: z.number().nullable(),
  next_funding_timestamp: z.number().nullable(),
});

export const FundingRateDataResponseSchema = z.object({
  base: z.string(),
  quote: z.string().nullable(),
  sources: z.array(FundingRateSourceSchema),
});
export type FundingRateDataResponse = z.infer<typeof FundingRateDataResponseSchema>;

export const EventResponseSchema = z.object({
  provider: z.enum(["polymarket", "kalshi"]),
  event_id: z.string(),
  title: z.string(),
  volume: z.number().nullable().optional(),
  volume_24h: z.number().nullable().optional(),
  open_time: z.number().nullable().optional(),
  close_time: z.number().nullable().optional(),
  is_merged: z.boolean().optional(),
  is_active: z.boolean(),
  kalshi_event_id: z.string().nullable().optional(),
  time_to_close_seconds: z.number().nullable().optional(),
});
export type EventResponse = z.infer<typeof EventResponseSchema>;

export const EventMarketItemSchema = z.object({
  id: z.string(),
  title: z.string().optional().nullable(),
  sub_title: z.string().optional().nullable(),
}).passthrough();

export const EventOutcomeSchema = z.object({
  name: z.string(),
  probability: z.number().optional().nullable(),
  sources: z.array(z.unknown()).optional(),
  method: z.string().optional(),
}).passthrough();

export const EventDetailResponseSchema = z.object({
  provider: z.enum(["polymarket", "kalshi"]).optional(),
  event_id: z.string().optional(),
  title: z.string(),
  rules: z.array(z.unknown()).optional(),
  open_time: z.string().nullable().optional(),
  close_time: z.string().nullable().optional(),
  volume: z.number().nullable().optional(),
  volume_24h: z.number().nullable().optional(),
  summary_data: z.unknown().optional(),
  url: z.union([z.string(), z.record(z.string())]).nullable().optional(),
  markets: z.record(z.array(EventMarketItemSchema)).optional(),
  is_merged: z.boolean().optional(),
  is_active: z.boolean(),
  outcomes: z.array(EventOutcomeSchema).optional(),
  time_to_close_seconds: z.number().nullable().optional(),
}).passthrough();
export type EventDetailResponse = z.infer<typeof EventDetailResponseSchema>;

export const PredictionMarketQuoteSchema = z.object({
  platform: z.enum(["polymarket", "kalshi"]),
  market_id: z.string(),
  outcome: z.enum(["yes", "no"]),
  side: z.enum(["buy", "sell"]).optional(),
  quote_notional: z.number().positive().optional(),
  depth: z.number().min(1).max(20).optional(),
});

export const ApiWrappedResponseSchema = z.object({
  code: z.number(),
  msg: z.string(),
  data: z.unknown(),
});

export interface DatalineClientConfig {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
  timeoutMs?: number;
}

export interface DatalineError {
  error: true;
  code:
    | "auth_failed"
    | "api_error"
    | "dataline_api_timeout"
    | "dataline_api_unreachable"
    | "invalid_input"
    | "not_supported"
    | "response_validation_error";
  message: string;
  status?: number;
  retryable: boolean;
}

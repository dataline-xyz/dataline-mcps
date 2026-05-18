import { describe, it, expect } from "vitest";
import type { EventDetailResponse } from "../../client/types.js";

function truncateMarketsDict(
  marketsDict: Record<string, unknown[]>,
  limit: number,
): { limitedMarkets: Record<string, unknown[]>; total_markets: number; markets_truncated: boolean } {
  const allMarkets = Object.values(marketsDict).flat();
  const total_markets = allMarkets.length;
  const limitedMarkets: Record<string, unknown[]> = {};
  let count = 0;
  for (const [platform, mktList] of Object.entries(marketsDict)) {
    if (count >= limit) break;
    const sliced = mktList.slice(0, limit - count);
    if (sliced.length > 0) limitedMarkets[platform] = sliced;
    count += sliced.length;
  }
  return { limitedMarkets, total_markets, markets_truncated: total_markets > limit };
}

describe("get_prediction_event_detail markets truncation", () => {
  it("truncates across platforms with limit", () => {
    const markets = {
      polymarket: [{ id: "1" }, { id: "2" }, { id: "3" }],
      kalshi: [{ id: "4" }, { id: "5" }],
    };
    const { limitedMarkets, total_markets, markets_truncated } = truncateMarketsDict(markets, 4);
    expect(total_markets).toBe(5);
    expect(markets_truncated).toBe(true);
    const allLimited = Object.values(limitedMarkets).flat();
    expect(allLimited).toHaveLength(4);
    expect(limitedMarkets["polymarket"]).toHaveLength(3);
    expect(limitedMarkets["kalshi"]).toHaveLength(1);
  });

  it("returns all markets when under limit", () => {
    const markets = {
      polymarket: [{ id: "1" }, { id: "2" }],
    };
    const { limitedMarkets, total_markets, markets_truncated } = truncateMarketsDict(markets, 20);
    expect(total_markets).toBe(2);
    expect(markets_truncated).toBe(false);
    expect(limitedMarkets["polymarket"]).toHaveLength(2);
  });

  it("handles empty markets dict", () => {
    const { limitedMarkets, total_markets, markets_truncated } = truncateMarketsDict({}, 20);
    expect(total_markets).toBe(0);
    expect(markets_truncated).toBe(false);
    expect(Object.keys(limitedMarkets)).toHaveLength(0);
  });

  it("skips platforms entirely when limit already reached", () => {
    const markets = {
      polymarket: [{ id: "1" }, { id: "2" }],
      kalshi: [{ id: "3" }],
    };
    const { limitedMarkets, total_markets } = truncateMarketsDict(markets, 2);
    expect(total_markets).toBe(3);
    expect(limitedMarkets["polymarket"]).toHaveLength(2);
    expect(limitedMarkets["kalshi"]).toBeUndefined();
  });
});

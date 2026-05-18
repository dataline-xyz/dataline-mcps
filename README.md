# @dataline-xyz/dataline-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server and TypeScript SDK for the [Dataline](https://www.dataline.xyz) data API.

It exposes a focused set of read-only market-data tools to MCP-compatible clients (Claude Desktop, Cursor, Continue, custom agents, etc.):

- Spot and perpetual prices for crypto assets
- Perpetual funding rates (annualized)
- Prediction-market categories, events, search, details, orderbook
- Best-quote helper that aggregates the orderbook into a single number

## Install

Using `npx` (no install required):

```bash
npx -y @dataline-xyz/dataline-mcp
```

Or install globally:

```bash
npm install -g @dataline-xyz/dataline-mcp
dataline-mcp
```

## Configure

The server reads credentials from environment variables:

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DATALINE_API_KEY` | yes | — | API key issued by Dataline |
| `DATALINE_SECRET_KEY` | yes | — | Secret used to sign requests (HMAC-SHA256) |
| `DATALINE_BASE_URL` | no | `https://www.dataline.xyz` | Override the API base URL |
| `DATALINE_MCP_TIMEOUT_MS` | no | `45000` | Per-request timeout in milliseconds |

See `.env.example` for a copy/pastable template.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "dataline": {
      "command": "npx",
      "args": ["-y", "@dataline-xyz/dataline-mcp"],
      "env": {
        "DATALINE_API_KEY": "your_api_key_here",
        "DATALINE_SECRET_KEY": "your_secret_key_here"
      }
    }
  }
}
```

### Cursor / Continue / other MCP clients

Use the same command + env mapping in your client's MCP configuration.

## Tools

| Tool | Purpose |
| --- | --- |
| `get_price` | Spot or swap price for a base/quote pair |
| `get_funding_rate` | Annualized funding rate for a perpetual contract |
| `get_odds_categories` | List prediction-market event categories |
| `get_odds_event_list` | List prediction-market events (paginated) |
| `search_prediction_events` | Full-text search across prediction events |
| `get_prediction_event_detail` | Full detail for a single prediction event |
| `get_odds_event_orderbook` | Orderbook (bids/asks) for a specific outcome market |
| `get_prediction_market_quote` | Convenience helper: best bid/ask + mid from the orderbook |

## SDK usage

```ts
import { DatalineClient } from "@dataline-xyz/dataline-mcp";

const client = new DatalineClient({
  apiKey: process.env.DATALINE_API_KEY!,
  secretKey: process.env.DATALINE_SECRET_KEY!,
});

const price = await client.getPrice({ base_currency: "BTC", quote_currency: "USDT" });
console.log(price);
```

## Development

```bash
pnpm install
pnpm build
pnpm test
```

The OpenAPI spec for the supported endpoints ships as `openapi.json` next to this README.

## License

[MIT](./LICENSE)

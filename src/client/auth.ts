export interface SignedHeaders {
  "X-API-Key": string;
  "X-Timestamp": string;
  "X-Signature": string;
}

export interface SignRequestParams {
  apiKey: string;
  secretKey: string;
  method: string;
  path: string;
  body?: string;
  timestamp?: string;
}

export async function signRequest(params: SignRequestParams): Promise<SignedHeaders> {
  const { apiKey, secretKey, method, body = "", timestamp } = params;
  const ts = timestamp ?? Date.now().toString();
  const message = `${ts}${method.toUpperCase()}${params.path}${body}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const signature = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return {
    "X-API-Key": apiKey,
    "X-Timestamp": ts,
    "X-Signature": signature,
  };
}

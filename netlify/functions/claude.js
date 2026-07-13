// Netlify serverless function — proxies requests to the Claude API.
// The API key lives ONLY in Netlify's environment variables (ANTHROPIC_API_KEY).
// It is never sent to the browser and never appears in this file.

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Browser preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error:
          "ANTHROPIC_API_KEY is not set. Add it in Netlify: Site settings → Environment variables.",
      }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON in request body" }),
    };
  }

  // Only allow the fields we actually use, and cap max_tokens so a leaked
  // page URL can't be used to run up a huge bill.
  const body = {
    model: payload.model || "claude-sonnet-4-6",
    max_tokens: Math.min(payload.max_tokens || 1000, 2000),
    messages: payload.messages || [],
  };

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "messages is required" }),
    };
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    return {
      statusCode: res.status,
      headers,
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: "Upstream request failed: " + err.message }),
    };
  }
};

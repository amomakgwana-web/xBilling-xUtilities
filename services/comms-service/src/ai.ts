/**
 * Optional server-side AI insight generator. The original mockups called
 * api.anthropic.com directly from the browser with no key, which cannot
 * work (CORS + would leak a secret if it did). Here the call happens
 * server-side and is entirely optional: without ANTHROPIC_API_KEY set, every
 * caller gets a deterministic canned response instead of an error.
 */
export async function generateInsight(system: string, prompt: string, fallback: string): Promise<{ text: string; mocked: boolean }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { text: fallback, mocked: true };
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 400,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { text: fallback, mocked: true };
    const body = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = body.content?.[0]?.text;
    return text ? { text, mocked: false } : { text: fallback, mocked: true };
  } catch {
    return { text: fallback, mocked: true };
  }
}

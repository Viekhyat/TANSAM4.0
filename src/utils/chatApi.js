// Simple chat API helper. Starts with a mock implementation but can call
// a custom endpoint or the OpenAI Chat Completions API when an API key is
// provided via options or Vite env (VITE_OPENAI_KEY).

export async function sendChatMessage({
  question = '',
  summary = '',
  charts = null,
  datasets = null,
  apiKey = null,
  timeoutMs = 12000,
} = {}) {
  // Only call OpenAI GPT-4 API
  const key = apiKey || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_OPENAI_KEY) || null;
  if (!key) throw new Error('No API key configured for chat');

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = {
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful data assistant that summarizes datasets and explains charts.' },
        { role: 'user', content: `${question}\n\nDataset summary:\n${summary}` },
      ],
      temperature: 0.2,
    };

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`OpenAI error ${res.status}: ${txt}`);
    }
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content || JSON.stringify(json);
    return { text };
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// Small convenience function to allow pluggable replacements later.
export default sendChatMessage;

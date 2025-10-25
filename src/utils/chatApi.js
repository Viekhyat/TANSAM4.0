// Simple chat API helper. Starts with a mock implementation but can call
// a custom endpoint or the OpenAI Chat Completions API when an API key is
// provided via options or Vite env (VITE_OPENAI_KEY).

export async function sendChatMessage({
  question = '',
  summary = '',
  charts = null,
  datasets = null,
  apiKey = '', // Use environment variable instead of hardcoding
  useMock = process.env.NODE_ENV === 'development',
  timeoutMs = 12000,
} = {}) {
  // Use mock response if useMock is true
  if (useMock) {
    return mockChatResponse(question, summary);
  }
  
  // Try to get API key from multiple sources
  const key = apiKey || 
              (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_OPENAI_KEY) || 
              localStorage.getItem('openai_api_key') || 
              null;
              
  if (!key) throw new Error('No API key configured for chat. Please add your API key in the settings.');

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

// Mock response function for testing without API key
function mockChatResponse(question, summary) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const responses = [
        "I've analyzed your data and found some interesting patterns.",
        "Based on your dataset, I can see several trends worth exploring.",
        "Your data shows some interesting correlations between variables.",
        "I've examined your charts and datasets. Would you like me to explain any specific aspect?",
        "From the summary provided, your data contains numeric and categorical variables that could be visualized effectively."
      ];
      
      // If question contains specific keywords, provide more targeted responses
      let response = "";
      if (question.toLowerCase().includes("summary")) {
        response = `Here's a summary of your data:\n${summary}`;
      } else if (question.toLowerCase().includes("chart") || question.toLowerCase().includes("visual")) {
        response = "Your charts show the relationship between variables in your dataset. Consider adding more visualizations to explore other dimensions of your data.";
      } else if (question.toLowerCase().includes("help")) {
        response = "I can help you analyze your data, explain charts, suggest visualizations, and answer questions about your datasets. Just ask!";
      } else {
        // Random response if no specific keywords
        response = responses[Math.floor(Math.random() * responses.length)];
      }
      
      resolve({ text: response });
    }, 800); // Simulate network delay
  });
}

// Small convenience function to allow pluggable replacements later.
export default sendChatMessage;

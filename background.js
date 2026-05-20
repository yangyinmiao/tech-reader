// background.js
console.log("[Tech Reader] background loaded");

browser.runtime.onMessage.addListener((message, sender) => {
  console.log("[Tech Reader] 收到消息:", message.type);
  if (message.type === "ANALYZE_SENTENCE") {
    return analyzeSentence(message.sentence);
  }
  if (message.type === "EXPLAIN_WORD") {
    return explainWord(message.word);
  }
});

async function explainWord(word) {
  const config = await browser.storage.local.get(["apiKey", "baseUrl", "model"]);
  if (!config.apiKey) return { error: "no_api_key" };

  const baseUrl = config.baseUrl || "https://api.openai.com/v1";
  const model = config.model || "gpt-4o-mini";

  const prompt = `You are a technical English vocabulary coach.
Explain the word or phrase: "${word}"

Rules:
- Write the explanation IN ENGLISH only, no Chinese
- Focus on its technical meaning in software/programming context
- Keep it under 2 sentences
- Include word type (noun/verb/adj/phrase)

Output ONLY valid JSON:
{
  "word": "${word}",
  "type": "",
  "explanation": "",
  "example": ""
}`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
      })
    });

    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    return { result: JSON.parse(content) };
  } catch (err) {
    console.error("[Tech Reader] explainWord 失败:", err.message);
    return { error: err.message };
  }
}

async function analyzeSentence(sentence) {
  console.log("[Tech Reader] 开始分析:", sentence.slice(0, 50));
  const config = await browser.storage.local.get(["apiKey", "baseUrl", "model"]);
  console.log("[Tech Reader] 配置:", { baseUrl: config.baseUrl, model: config.model, hasKey: !!config.apiKey });

  if (!config.apiKey) {
    return { error: "no_api_key" };
  }

  const baseUrl = config.baseUrl || "https://api.openai.com/v1";
  const model = config.model || "gpt-4o-mini";

  const prompt = `You are a technical English reading coach.
The user selected this sentence from a technical document:
"${sentence}"

Analyze it in three parts:

1. SKELETON
Identify the true subject and main verb, stripped of all modifiers.

2. STRUCTURE
Name the sentence type (e.g. relative clause, passive voice, cleft sentence).
Then rewrite the core meaning in one simple English sentence.

3. PLAIN MEANING
Express the full meaning in natural Chinese, as if explaining to a colleague.
Not a word-for-word translation — what does this sentence actually say?

Output ONLY valid JSON, no extra text:
{
  "skeleton": { "subject": "", "verb": "", "object": "" },
  "structure": { "type": "", "simplified": "" },
  "plain": ""
}`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3
      })
    });

    console.log("[Tech Reader] HTTP 状态:", response.status);
    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    console.log("[Tech Reader] AI 返回:", content.slice(0, 100));
    return { result: JSON.parse(content) };
  } catch (err) {
    console.error("[Tech Reader] 请求失败:", err.message);
    return { error: err.message };
  }
}

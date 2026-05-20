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

  const prompt = `You are a technical English reading coach. Follow this methodology strictly:

## CORE PRINCIPLE
Do NOT translate word-by-word. Read sentences like an AST (Abstract Syntax Tree), not linearly.
A sentence = skeleton + modifiers + supplements.

## READING METHODOLOGY

Step 1 - Find the skeleton first:
Ignore commas, dashes, parenthetical phrases, and relative clauses.
Only look for: WHO + DOES WHAT + TO WHAT

Step 2 - Identify fixed phrase patterns (interpret as semantic units, never split):
Common patterns:
- "look to" = rely on / turn to
- "help ... by ..." = help through ...
- "take on" = take responsibility for
- "build on" = develop further based on
- "open up" = bring about / create
- "eat up" = consume (memory/time)
- "scale up" = expand
- "A is key to B" = A is critical for B
- "shoulder" = take on (responsibility)

Step 3 - Identify modifier structures:
- Relative clause (that/which/who): describes a noun
- Dash (—): example or supplement
- "by + gerund": how something is done
- Gerund subject (e.g. "Integrating X into Y"): the action itself is the subject

Step 4 - Note nominalization (technical English converts verbs to nouns):
- "use" → "leveraging"
- "put into" → "integrating into"
Always restore to natural meaning.

## ANALYSIS TASK
Analyze this sentence from a technical document:
"${sentence}"

## OUTPUT FORMAT
Output ONLY valid JSON, no extra text:
{
  "skeleton": {
    "subject": "true subject, stripped of all modifiers",
    "verb": "main verb phrase as semantic unit (e.g. 'relies on', not just 'relies')",
    "object": "object if any, else empty string"
  },
  "ast": {
    "root": "skeleton rewritten as one minimal English sentence",
    "branches": [
      { "role": "modifies subject | modifies verb | purpose | condition | example | supplement", "content": "branch content in English" }
    ]
  },
  "fixed_phrases": [
    { "phrase": "the original phrase", "meaning": "its semantic meaning in this context" }
  ],
  "structure": {
    "type": "sentence type (e.g. relative clause, passive voice, cleft sentence, gerund subject)",
    "simplified": "core meaning as one simple English sentence"
  },
  "plain": "用自然流畅的中文重新表达这句话的意思。不是翻译，而是：如果你完全理解了这句话，你会怎么跟中国同事口头解释这个意思？要求：①整句全部用中文，不要中英混杂；②只有无法替代的编程专有名词才保留英文（如 component、API、props、state、runtime），其他所有词都翻成中文；③固定短语按语义整体翻译，不要逐词对应；④语气自然，像开发者在说话，不要书面翻译腔。"
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

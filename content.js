// content.js
console.log("[Tech Reader] content loaded");
// 监听选中文字，注入分析面板

let panel = null;

document.addEventListener("mouseup", (e) => {
  // 点到触发按钮本身，不处理（让 click 事件去处理）
  if (e.target && e.target.id === "tech-reader-trigger") return;

  const selected = window.getSelection().toString().trim();
  console.log("[Tech Reader] mouseup, selected:", selected.slice(0, 30));

  // 点到面板本身，不触发
  if (panel && panel.contains(e.target)) return;

  if (selected.length > 10 && /[a-zA-Z]/.test(selected)) {
    showTriggerButton(e.clientX, e.clientY, selected);
  } else {
    removeTriggerButton();
  }
});

document.addEventListener("mousedown", (e) => {
  if (panel && !panel.contains(e.target)) {
    removePanel();
  }
});

function showTriggerButton(x, y, sentence) {
  removeTriggerButton();
  console.log("[Tech Reader] 创建分析按钮, x:", x, "y:", y);

  const btn = document.createElement("div");
  btn.id = "tech-reader-trigger";
  btn.textContent = "分析";
  btn.style.cssText = `
    position: fixed;
    left: ${x + 8}px;
    top: ${y - 30}px;
    z-index: 2147483647;
    background: #1a1a2e;
    color: #e0e0ff;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    font-family: system-ui, sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    user-select: none;
  `;

  btn.addEventListener("click", () => {
    console.log("[Tech Reader] 分析按钮被点击");
    removeTriggerButton();
    showPanel(sentence);
  });

  document.body.appendChild(btn);
}

function removeTriggerButton() {
  const btn = document.getElementById("tech-reader-trigger");
  if (btn) btn.remove();
}

function showPanel(sentence) {
  removePanel();

  panel = document.createElement("div");
  panel.id = "tech-reader-panel";
  panel.innerHTML = `
    <div class="tr-header">
      <span class="tr-title">Tech Reader</span>
      <button class="tr-close">✕</button>
    </div>
    <div class="tr-sentence">"${escapeHtml(sentence)}"</div>
    <div class="tr-loading">分析中…</div>
    <div class="tr-content" style="display:none">
      <div class="tr-section" id="tr-skeleton">
        <div class="tr-section-title">句子骨架 <span class="tr-hint">核心主谓宾</span></div>
        <div class="tr-section-body"></div>
      </div>
      <div class="tr-section tr-locked" id="tr-structure">
        <div class="tr-section-title">句型分析 <span class="tr-unlock-hint">点击展开</span></div>
        <div class="tr-section-body" style="display:none"></div>
      </div>
      <div class="tr-section tr-locked" id="tr-plain">
        <div class="tr-section-title">用自己的话说 <span class="tr-unlock-hint">点击展开</span></div>
        <div class="tr-section-body" style="display:none"></div>
      </div>
    </div>
    <div class="tr-error" style="display:none"></div>
  `;

  document.body.appendChild(panel);

  panel.querySelector(".tr-close").addEventListener("click", removePanel);

  // 锁定层点击展开
  ["tr-structure", "tr-plain"].forEach(id => {
    const section = panel.querySelector(`#${id}`);
    section.querySelector(".tr-section-title").addEventListener("click", () => {
      if (section.classList.contains("tr-locked")) return;
      const body = section.querySelector(".tr-section-body");
      body.style.display = body.style.display === "none" ? "block" : "none";
    });
  });

  // 调用分析
  console.log("[Tech Reader] 发送分析请求:", sentence.slice(0, 50));
  browser.runtime.sendMessage({ type: "ANALYZE_SENTENCE", sentence }).then(response => {
    console.log("[Tech Reader] 收到响应:", JSON.stringify(response).slice(0, 200));

    panel.querySelector(".tr-loading").style.display = "none";

    if (response.error) {
      const errEl = panel.querySelector(".tr-error");
      errEl.style.display = "block";
      errEl.textContent = response.error === "no_api_key"
        ? "请先在插件设置页填写 API Key"
        : `请求失败：${response.error}`;
      return;
    }

    const { skeleton, structure, plain } = response.result;
    const content = panel.querySelector(".tr-content");
    content.style.display = "block";

    // 骨架层
    const skeletonBody = panel.querySelector("#tr-skeleton .tr-section-body");
    skeletonBody.innerHTML = `
      <div class="tr-row"><span class="tr-label">主语</span><span class="tr-value">${escapeHtml(skeleton.subject)}</span></div>
      <div class="tr-row"><span class="tr-label">谓语</span><span class="tr-value">${escapeHtml(skeleton.verb)}</span></div>
      ${skeleton.object ? `<div class="tr-row"><span class="tr-label">宾语</span><span class="tr-value">${escapeHtml(skeleton.object)}</span></div>` : ""}
    `;

    // 句型层，解锁但折叠
    const structureSection = panel.querySelector("#tr-structure");
    structureSection.classList.remove("tr-locked");
    structureSection.querySelector(".tr-section-body").innerHTML = `
      <div class="tr-row"><span class="tr-label">句型</span><span class="tr-value">${escapeHtml(structure.type)}</span></div>
      <div class="tr-row"><span class="tr-label">简化</span><span class="tr-value">${escapeHtml(structure.simplified)}</span></div>
    `;

    // 意思层，解锁但折叠
    const plainSection = panel.querySelector("#tr-plain");
    plainSection.classList.remove("tr-locked");
    plainSection.querySelector(".tr-section-body").innerHTML = `
      <div class="tr-plain-text">${escapeHtml(plain)}</div>
    `;
  }).catch(err => {
    console.error("[Tech Reader] sendMessage 失败:", err);
    if (panel) {
      panel.querySelector(".tr-loading").style.display = "none";
      const errEl = panel.querySelector(".tr-error");
      errEl.style.display = "block";
      errEl.textContent = "通信失败：" + err.message;
    }
  });
}

function removePanel() {
  if (panel) {
    panel.remove();
    panel = null;
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Hover 查词 ──────────────────────────────────────────

let hoverTimer = null;
let tooltip = null;
let lastWord = null;

document.addEventListener("mousemove", (e) => {
  const el = e.target;
  if (el.id === "tech-reader-trigger" || el.closest("#tech-reader-panel") || el.closest("#tech-reader-tooltip")) return;
  if (!["P", "LI", "TD", "SPAN", "A", "H1", "H2", "H3", "H4", "CODE", "PRE"].includes(el.tagName)) {
    clearTimeout(hoverTimer);
    removeTooltip();
    lastWord = null;
    return;
  }

  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    const word = getWordUnderMouse(e);
    if (!word) {
      removeTooltip();
      lastWord = null;
      return;
    }
    // 同一个词不重复请求
    if (word === lastWord) return;
    lastWord = word;
    fetchAndShowTooltip(word, e.clientX, e.clientY);
  }, 600);
});

document.addEventListener("mouseover", (e) => {
  // 鼠标移到 tooltip 上，保持显示
  if (tooltip && e.target && tooltip.contains(e.target)) return;
});

document.addEventListener("mouseout", (e) => {
  if (tooltip && e.relatedTarget && tooltip.contains(e.relatedTarget)) return;
  clearTimeout(hoverTimer);
  removeTooltip();
  lastWord = null;
});

function getWordUnderMouse(e) {
  let node, offset;

  if (document.caretPositionFromPoint) {
    // Firefox
    const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
    if (!pos) return null;
    node = pos.offsetNode;
    offset = pos.offset;
  } else if (document.caretRangeFromPoint) {
    // Chrome fallback
    const range = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (!range) return null;
    node = range.startContainer;
    offset = range.startOffset;
  } else {
    return null;
  }

  if (!node || node.nodeType !== Node.TEXT_NODE) return null;

  const text = node.textContent;

  // 向左找词边界
  let start = offset;
  while (start > 0 && /[a-zA-Z\-]/.test(text[start - 1])) start--;
  // 向右找词边界
  let end = offset;
  while (end < text.length && /[a-zA-Z\-]/.test(text[end])) end++;

  const word = text.slice(start, end);
  if (!/[a-zA-Z]+/.test(word)) return null;
  // 过滤常见无意义短词
  const stopWords = new Set(["a", "an", "the", "is", "are", "was", "were", "be", "to", "of", "in", "it", "at", "on", "or", "as", "by", "do"]);
  if (stopWords.has(word.toLowerCase())) return null;
  return word;
}

async function fetchAndShowTooltip(word, x, y) {
  removeTooltip();

  // 先查本地词库
  const existing = await getWordRecord(word);

  // 创建 tooltip 骨架
  tooltip = document.createElement("div");
  tooltip.id = "tech-reader-tooltip";
  tooltip.style.cssText = `
    position: fixed;
    left: ${Math.min(x + 12, window.innerWidth - 320)}px;
    top: ${y + 20}px;
    z-index: 2147483647;
  `;

  if (existing) {
    // 本地有记录，直接展示，不请求 AI
    tooltip.innerHTML = buildTooltipHtml(existing.explanation, existing.type, null, existing.count);
    document.body.appendChild(tooltip);
    recordWordLocal(word, existing.explanation, existing.type);
  } else {
    // 展示加载状态，同时请求 AI
    tooltip.innerHTML = buildTooltipHtml(null, null, true);
    document.body.appendChild(tooltip);

    const response = await browser.runtime.sendMessage({ type: "EXPLAIN_WORD", word });
    if (!tooltip) return; // 鼠标已移走

    if (response.error) {
      tooltip.innerHTML = buildTooltipHtml(null, null, false, 0, response.error);
    } else {
      const { explanation, type, example } = response.result;
      tooltip.innerHTML = buildTooltipHtml(explanation, type, false, 0, null, example);
      recordWordLocal(word, explanation, type);
    }
  }
}

function buildTooltipHtml(explanation, type, loading, count, error, example) {
  if (loading) {
    return `<div class="tr-tt-loading">查询中…</div>`;
  }
  if (error) {
    return `<div class="tr-tt-error">${escapeHtml(error)}</div>`;
  }
  return `
    ${type ? `<div class="tr-tt-type">${escapeHtml(type)}</div>` : ""}
    <div class="tr-tt-explanation">${escapeHtml(explanation || "")}</div>
    ${example ? `<div class="tr-tt-example">${escapeHtml(example)}</div>` : ""}
    ${count > 0 ? `<div class="tr-tt-count">你已查过 ${count} 次</div>` : ""}
  `;
}

function removeTooltip() {
  if (tooltip) {
    tooltip.remove();
    tooltip = null;
  }
}

// IndexedDB 简单封装（content script 里用）
function openWordDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("tech-reader", 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("words")) {
        db.createObjectStore("words", { keyPath: "word" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getWordRecord(word) {
  const db = await openWordDB();
  return new Promise((resolve) => {
    const req = db.transaction("words", "readonly").objectStore("words").get(word.toLowerCase());
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

async function recordWordLocal(word, explanation, type) {
  const db = await openWordDB();
  const existing = await getWordRecord(word);
  const entry = existing
    ? { ...existing, count: existing.count + 1, lastSeen: Date.now() }
    : { word: word.toLowerCase(), explanation, type, count: 1, firstSeen: Date.now(), lastSeen: Date.now() };

  db.transaction("words", "readwrite").objectStore("words").put(entry);
}

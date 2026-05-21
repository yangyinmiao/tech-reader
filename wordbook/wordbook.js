// wordbook.js
// 词库可视化页面逻辑

async function getAllWords() {
  const all = await browser.storage.local.get(null);
  return Object.entries(all)
    .filter(([k]) => k.startsWith("word:"))
    .map(([, v]) => v);
}

async function deleteWord(word) {
  await browser.storage.local.remove("word:" + word.toLowerCase());
}

// ---- 状态 ----
let allWords = [];
let currentSort = "count";
let searchQuery = "";

// ---- 初始化 ----
document.addEventListener("DOMContentLoaded", async () => {
  allWords = await getAllWords();
  updateStats();
  renderList();

  // 搜索
  document.getElementById("wb-search").addEventListener("input", (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderList();
  });

  // 排序按钮
  document.querySelectorAll(".wb-sort-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".wb-sort-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentSort = btn.dataset.sort;
      renderList();
    });
  });
});

function updateStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTs = today.getTime();

  const total = allWords.length;
  const todayNew = allWords.filter((w) => w.firstSeen >= todayTs).length;
  const totalLookups = allWords.reduce((sum, w) => sum + (w.count || 0), 0);
  const familiar = allWords.filter((w) => w.mastered).length;

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-today").textContent = todayNew;
  document.getElementById("stat-lookups").textContent = totalLookups;
  document.getElementById("stat-familiar").textContent = familiar;
}

function getSortedFiltered() {
  let words = allWords;

  if (searchQuery) {
    words = words.filter(
      (w) =>
        w.word.toLowerCase().includes(searchQuery) ||
        (w.explanation || "").toLowerCase().includes(searchQuery)
    );
  }

  const sorted = [...words];
  switch (currentSort) {
    case "count":
      sorted.sort((a, b) => (b.count || 0) - (a.count || 0));
      break;
    case "lastSeen":
      sorted.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
      break;
    case "firstSeen":
      sorted.sort((a, b) => (b.firstSeen || 0) - (a.firstSeen || 0));
      break;
    case "az":
      sorted.sort((a, b) => a.word.localeCompare(b.word));
      break;
  }
  return sorted;
}

function countClass(count) {
  if (count >= 5) return "high";
  if (count >= 2) return "mid";
  return "low";
}

function formatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays} 天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function renderList() {
  const words = getSortedFiltered();
  const list = document.getElementById("wb-list");
  const empty = document.getElementById("wb-empty");

  // 清空旧卡片（保留 empty 节点）
  Array.from(list.children).forEach((el) => {
    if (el.id !== "wb-empty") el.remove();
  });

  if (words.length === 0) {
    empty.style.display = "block";
    // 搜索无结果时更换提示文字
    const p = empty.querySelector("p");
    if (searchQuery) {
      p.textContent = `没有找到包含"${searchQuery}"的词`;
    } else {
      p.textContent = "还没有收录任何单词";
    }
    return;
  }

  empty.style.display = "none";

  const fragment = document.createDocumentFragment();
  words.forEach((w) => {
    const card = document.createElement("div");
    card.className = "wb-card";
    card.dataset.word = w.word;

    const isMastered = !!w.mastered;
    const reviewPassed = w.reviewPassed || 0;
    const cls = countClass(w.count || 0);

    // 掌握度标签
    let masteryBadge = "";
    if (isMastered) {
      masteryBadge = `<span class="wb-mastery-badge mastered">已掌握 ✓</span>`;
    } else if (reviewPassed >= 1) {
      masteryBadge = `<span class="wb-mastery-badge reviewing">复习中 ${reviewPassed}/2</span>`;
    }

    card.innerHTML = `
      <div class="wb-card-top">
        <span class="wb-word">${escapeHtml(w.word)}</span>
        <div class="wb-card-actions">
          <button class="wb-btn-del" data-word="${escapeHtml(w.word)}">删除</button>
        </div>
      </div>
      ${w.type ? `<span class="wb-type">${escapeHtml(w.type)}</span>` : ""}
      <div class="wb-explanation">${escapeHtml(w.explanation || "暂无释义")}</div>
      <div class="wb-card-meta">
        <span class="wb-count">查了 <span class="wb-count-num ${cls}">${w.count || 0}</span> 次</span>
        <span class="wb-date">最近 ${formatDate(w.lastSeen)}</span>
      </div>
      ${masteryBadge}
    `;

    card.querySelector(".wb-btn-del").addEventListener("click", async (e) => {
      const word = e.currentTarget.dataset.word;
      await deleteWord(word);
      allWords = allWords.filter((item) => item.word !== word);
      updateStats();
      renderList();
    });

    fragment.appendChild(card);
  });

  list.appendChild(fragment);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

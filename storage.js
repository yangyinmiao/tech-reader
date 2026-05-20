// storage.js
// IndexedDB 词库封装

const DB_NAME = "tech-reader";
const DB_VERSION = 1;
const STORE_NAME = "words";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "word" });
        store.createIndex("count", "count", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// 查一个词的记录（没有返回 null）
async function getWord(word) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(word.toLowerCase());
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// 记录查词（首次创建，之后累加次数）
async function recordWord(word, explanation) {
  const db = await openDB();
  const existing = await getWord(word);
  const entry = existing
    ? { ...existing, count: existing.count + 1, lastSeen: Date.now() }
    : { word: word.toLowerCase(), explanation, count: 1, firstSeen: Date.now(), lastSeen: Date.now() };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put(entry);
    req.onsuccess = () => resolve(entry);
    req.onerror = () => reject(req.error);
  });
}

// 获取所有词（按查询次数排序）
async function getAllWords() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const words = req.result.sort((a, b) => b.count - a.count);
      resolve(words);
    };
    req.onerror = () => reject(req.error);
  });
}

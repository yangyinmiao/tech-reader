// settings.js

// 加载已保存的配置
browser.storage.local.get(["apiKey", "baseUrl", "model"]).then(config => {
  if (config.apiKey) document.getElementById("apiKey").value = config.apiKey;
  if (config.baseUrl) document.getElementById("baseUrl").value = config.baseUrl;
  if (config.model) document.getElementById("model").value = config.model;
});

// 预设 URL 快速填入
document.querySelectorAll(".preset-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.getElementById("baseUrl").value = btn.dataset.url;
  });
});

// 保存
document.getElementById("saveBtn").addEventListener("click", () => {
  const apiKey = document.getElementById("apiKey").value.trim();
  const baseUrl = document.getElementById("baseUrl").value.trim();
  const model = document.getElementById("model").value.trim();

  browser.storage.local.set({ apiKey, baseUrl, model }).then(() => {
    const status = document.getElementById("saveStatus");
    status.classList.add("visible");
    setTimeout(() => status.classList.remove("visible"), 2000);
  });
});

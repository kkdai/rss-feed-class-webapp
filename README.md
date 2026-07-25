# 📡 FeedFlow - Mobile-First RSS Reader with Gemini AI

[![Cloud Run](https://img.shields.io/badge/Deployed%20on-Google%20Cloud%20Run-blue?logo=googlecloud)](https://feedflow-660825558664.asia-east1.run.app)
[![Node.js](https://img.shields.io/badge/Node.js-v20-green?logo=nodedotjs)](https://nodejs.org)
[![Gemini AI](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-purple?logo=googlegemini)](https://ai.google.dev)

**FeedFlow** 是一款主要針對手機瀏覽器設計的現代化 RSS 閱讀器，復刻經典 **Feedly Classic** 的簡潔高效體驗，並結合 **Gemini 2.5 Flash** 提供外文內容自動語系辨識與繁體中文翻譯。

👉 **[立即體驗線上 Demo 網頁](https://feedflow-660825558664.asia-east1.run.app)**

---

## ✨ 核心功能

### 1. 📡 訂閱與資料夾管理
- **RSS 自動探索**：輸入任何網站 URL 或 RSS 連結，系統會自動探索 Feed 並提供內容預覽。
- **資料夾分組**：自由建立、重新命名與刪除資料夾（Collections），將訂閱源進行分類管理。
- **側欄導航**：分類顯示未讀數量、支援展開/收合資料夾與快速刪除訂閱。

### 2. 📰 多檢視閱讀模式 (4 View Modes)
- **Magazine View（雜誌模式）**：預設精美圖文摘要卡片，適合快讀資訊。
- **List View（精簡列表）**：高密度顯示標題與時間，適合大批瀏覽。
- **Title-Only View（純標題）**：極簡設計，專注於文章標題。
- **Cards View（大圖卡片）**：以大圖為主的視覺卡片佈局。

### 3. 🌐 語言識別與 Gemini AI 自動翻譯
- **原文語系標註**：自動辨識文章語言（如英文 `EN`、日文 `JA`、簡體中文 `ZH-CN`、韓文 `KO` 等），並在卡片與閱讀器上顯示語言徽章。
- **Gemini 2.5 Flash 自動翻譯**：非繁體中文內容自動使用 Google 經濟高效的 Gemini 2.5 Flash 模型翻譯標題與全文成繁體中文。
- **雙向切換**：閱讀器內提供「🌐 顯示原文 / ✨ 顯示 Gemini 繁中翻譯」一鍵切換按鈕。
- **本地快取**：翻譯結果快取於 `localStorage`，避免重複 API 請求。

### 4. 📱 行動優化 UX/UI
- **全屏沉浸閱讀器**：點擊文章順暢滑出，支援手機**右滑手勢返回**。
- **已讀與未讀管理**：捲動/點擊自動更新已讀狀態、支援「一鍵全部標記已讀」。
- **Premium 深色主題**：基於 Glassmorphism 毛玻璃質感與流暢微動畫設計。

---

## 🛠️ 技術架構

```
feedflow/
├── server.js           # Express 後端 (RSS 解析代理 + Gemini 翻譯 API + 靜態檔服務)
├── package.json         # Node.js ESM 專案設定
├── Dockerfile           # Multi-stage Docker 容器構建
├── public/
│   ├── index.html       # Mobile-first SPA 主頁
│   ├── manifest.json    # PWA web app manifest
│   ├── css/
│   │   └── style.css    # Premium 深色主題 CSS
│   └── js/
│       ├── app.js       # 前端 UI 控制邏輯
│       ├── store.js     # localStorage 資料持久層
│       └── api.js       # 後端 API 通訊模組
```

- **前端**：Vanilla HTML5 / CSS3 / ES Modules（無框架負擔，極速載入）
- **後端**：Node.js 20, Express, `rss-parser`, `cheerio`
- **AI 整合**：Google Gemini 2.5 Flash API (`https://generativelanguage.googleapis.com`)
- **部署**：Google Cloud Run (asia-east1)

---

## 🚀 本地開發與執行

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數（可選）

建立 `.env` 檔案或在終端機中設定 `GEMINI_API_KEY`（用於啟用 AI 翻譯）：

```bash
export GEMINI_API_KEY="your-gemini-api-key"
export PORT=8080
```

### 3. 啟動開發伺服器

```bash
npm start
```

打開瀏覽器存取 `http://localhost:8080` 即可開始測試。

---

## ☁️ 部署至 Google Cloud Run

本專案包含完整的 `Dockerfile`，可使用 `gcloud` 一鍵部署：

```bash
gcloud run deploy feedflow \
  --source . \
  --region asia-east1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars GEMINI_API_KEY="your-gemini-api-key"
```

---

## 📄 授權條款

MIT License

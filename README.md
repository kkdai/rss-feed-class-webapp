# 📡 FeedFlow - Mobile-First RSS Reader with Gemini AI & LINE Login

[![Cloud Run](https://img.shields.io/badge/Deployed%20on-Google%20Cloud%20Run-blue?logo=googlecloud)](https://feedflow-660825558664.asia-east1.run.app)
[![Firestore](https://img.shields.io/badge/Database-Google%20Firestore-orange?logo=firebase)](https://firebase.google.com/docs/firestore)
[![LINE Login](https://img.shields.io/badge/Auth-LINE%20Login%20%2F%20LIFF-06C755?logo=line)](https://developers.line.biz)
[![Gemini AI](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-purple?logo=googlegemini)](https://ai.google.dev)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**FeedFlow** 是一款專為手機瀏覽器設計的現代化 RSS 閱讀器，復刻經典 **Feedly Classic** 的簡潔高效體驗，整合 **Google Firestore** 雲端多使用者資料庫、**LINE Login (LINE UID)** 帳號綁定、多國語言介面 (i18n)，並結合 **Gemini 2.5 Flash** 提供外文內容自動語系辨識與即時繁體中文翻譯。


<img width="1179" height="2556" alt="image" src="https://github.com/user-attachments/assets/90d18b33-c20e-43a1-9215-596a6f6fa214" />
<img width="1179" height="2556" alt="image" src="https://github.com/user-attachments/assets/d7d43ec6-b3ff-4245-bb8c-973cd19cf614" />


---

## ✨ 核心功能特色

### 1. 💬 LINE Login 註冊與身份驗證
- **LINE UID 帳號綁定**：支援使用 LINE 登入後取得的 **LINE User ID (UID)** 作為雲端身份辨識。
- **LINE LIFF SDK 整合**：在 LINE App 內建瀏覽器環境開啟時自動進行連動認證。
- **LINE OAuth 2.1 認證流**：提供標準 OAuth 2.1 Code Grant 重導向與 Callback 處理解析。

### 2. 🔥 Google Firestore 雲端資料庫與閱讀進度
- **多租戶資料隔離**：每位使用者的 RSS 訂閱清單、分類資料夾、偏好設定均儲存在專屬 Firestore 路徑 (`users/{LINE_UID}/...`)。
- **跨裝置閱讀進度記錄**：精確紀錄每個 Feed 的最新閱讀位置 (`lastReadArticleId`) 與所有已讀文章 ID 列表 (`readArticleIds`)。
- **自動復原與抓取 (Auto-Hydration)**：重新部署或更換裝置時，系統從 Firestore 載入訂閱列表後自動在背景抓取並解析最新 RSS 文章。

### 3. 🌐 語言識別與 Gemini 2.5 Flash 自動翻譯
- **豐富 RSS 搜尋預覽**：搜尋或輸入 RSS 網址時，Gemini 2.5 Flash 會即時翻譯訂閱源標題、簡介以及**最新 3 篇範例文章**。
- **主視窗卡片自動背景翻譯**：主列表瀏覽非繁體中文文章（如韓文、日文、英文、簡體中文）時，系統自動發送 Gemini 背景翻譯並即時更新卡片與 **`✨ 繁中`** 徽章。
- **閱讀器雙向切換**：點擊文章閱讀時，提供「🌐 顯示原文 / ✨ 顯示 Gemini 繁中翻譯」一鍵切換按鈕。

### 4. 📰 多檢視閱讀模式 (4 View Modes)
- **Magazine View（雜誌模式）**：預設精美圖文摘要卡片，適合快讀資訊。
- **List View（精簡列表）**：高密度顯示標題與時間，適合大批瀏覽。
- **Title-Only View（純標題）**：極簡設計，專注於文章標題。
- **Cards View（大圖卡片）**：以大圖為主的視覺卡片佈局。

### 5. 🌍 多國語言介面 (i18n)
- 支援 **繁體中文 (`zh-TW`)**、**英文 (`en`)**、**日本語 (`ja`)** 介面語言隨時切換。
- 支援自由設定 Gemini 翻譯目標語言。

---

## 🛠️ 技術架構

```text
feedflow/
├── server.js           # Express 後端 (RSS 解析 + Firestore SDK + Gemini 2.5 API + LINE Auth)
├── package.json         # Node.js ESM 專案設定
├── Dockerfile           # Multi-stage Docker 容器構建
├── public/
│   ├── index.html       # Mobile-first SPA 主頁 (包含 LINE Login Modal)
│   ├── manifest.json    # PWA web app manifest
│   ├── css/
│   │   └── style.css    # Premium 深色主題 CSS (Glassmorphism & LINE Theme)
│   └── js/
│       ├── app.js       # 前端主控制邏輯 (i18n、自動翻譯、LIFF)
│       ├── store.js     # localStorage + Firestore 雙層快取持久層
│       ├── api.js       # 後端 REST API 與 LINE Auth 通訊模組
│       └── i18n.js      # 多國語言字典 (zh-TW, en, ja)
```

- **前端**：Vanilla HTML5 / CSS3 / ES Modules / LINE LIFF SDK
- **後端**：Node.js 20, Express, `@google-cloud/firestore`, `rss-parser`, `cheerio`
- **資料庫**：Google Cloud Firestore (`users/{userId}/...`)
- **AI 整合**：Google Gemini 2.5 Flash API
- **身份驗證**：LINE Login OAuth 2.1 & LIFF SDK
- **雲端部署**：Google Cloud Run (asia-east1)

---

## 🔑 LINE Login Channel 設定指引

在 [LINE Developers Console](https://developers.line.biz/) 的 LINE Login Channel 設定中，請設定：

- **Callback URL (Redirect URI)**：
  ```text
  https://feedflow-660825558664.asia-east1.run.app/api/auth/line/callback
  ```
- **Scope**：`profile`, `openid`

---

## 🚀 本地開發與執行

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

建立 `.env` 檔案或在終端機中設定環境變數（以下皆為範例值，請替換成你自己的）：

```bash
export SESSION_SECRET="$(openssl rand -hex 32)"
export GEMINI_API_KEY="your-gemini-api-key"
export LINE_CHANNEL_ID="your-line-channel-id"
export LINE_CHANNEL_SECRET="your-line-channel-secret"
export LINE_LIFF_ID="your-line-liff-id"
export GCP_PROJECT="your-gcp-project-id"
export PORT=8080
```

`SESSION_SECRET` 是必要的，沒有設定會直接拋錯拒絕啟動；`LINE_CHANNEL_SECRET` 請到 [LINE Developers Console](https://developers.line.biz/) 該 Channel 的設定頁取得，切勿提交到版本控制。

### 3. 啟動開發伺服器

```bash
npm start
```

開啟瀏覽器存取 `http://localhost:8080` 即可開始測試。

---

## ☁️ 部署至 Google Cloud Run

本專案包含完整的 `Dockerfile`，可使用 `gcloud` 一鍵部署。密鑰類的值（`SESSION_SECRET`、`LINE_CHANNEL_SECRET`、`GEMINI_API_KEY`）建議先存進 [Secret Manager](https://cloud.google.com/secret-manager)，用 `--set-secrets` 帶入，不要用 `--set-env-vars` 明碼傳遞：

```bash
# 先把密鑰存進 Secret Manager（只需執行一次）
printf '%s' "$SESSION_SECRET" | gcloud secrets create session-secret --data-file=-
printf '%s' "$LINE_CHANNEL_SECRET" | gcloud secrets create line-channel-secret --data-file=-
printf '%s' "$GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-

gcloud run deploy feedflow \
  --source . \
  --project <YOUR_GCP_PROJECT> \
  --region asia-east1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --cpu 1 \
  --max-instances 3 \
  --set-env-vars LINE_CHANNEL_ID="your-line-channel-id",LINE_LIFF_ID="your-line-liff-id",GCP_PROJECT="<YOUR_GCP_PROJECT>" \
  --set-secrets SESSION_SECRET=session-secret:latest,LINE_CHANNEL_SECRET=line-channel-secret:latest,GEMINI_API_KEY=gemini-api-key:latest
```

Cloud Run 的服務身份（service account）本身若已有 `roles/aiplatform.user`，翻譯功能會優先走 Vertex AI ADC，`GEMINI_API_KEY` 只是本地開發沒有 ADC 時的備援，非必要。

---

## 📄 授權條款

MIT License

# 衡鑑：大學雙重重大性評估平台

第一版 MVP 將利害關係人問卷、雙重重大性統計、AI 文字摘要、重大性矩陣與 Word 報告整合在同一套流程。

## GitHub Pages 公開展示

`.github/workflows/deploy-pages.yml` 會將前端建置為純靜態展示版。展示版使用虛構彙總資料，
不連接 FastAPI、PostgreSQL 或 OpenAI，也不會永久保存問卷內容。完整資料寫入與正式 Word
輸出仍需使用下方的本機或 Docker 部署。

## 已完成範圍

- 利害關係人帳號登入與角色權限
- 11 項環境、社會、治理議題庫
- 組織影響、衝擊重大性、財務重大性三維度問卷
- 問卷更新、填答來源與時間留存
- 自動平均、四象限判定與 Chart.js 矩陣
- 開放題關鍵字統計
- OpenAI 中英文分析；未設定金鑰時使用可重現的本機摘要
- 「2.3 利害關係人溝通、2.4 重大主題分析、2.5 雙重重大性評估」Word 匯出
- Docker Compose + PostgreSQL 部署

## 本機啟動

後端預設使用 SQLite，不需要先安裝 PostgreSQL。

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements-dev.txt
.\.venv\Scripts\uvicorn app.main:app --reload
```

另開終端：

```powershell
cd frontend
npm install
npm run dev
```

開啟 `http://localhost:3000`。API 文件位於 `http://localhost:8000/docs`。

## 展示帳號

| 身分 | 帳號 | 密碼 |
| --- | --- | --- |
| 管理者 | `admin@nuk.edu.tw` | `admin123` |
| 學生填答者 | `student@nuk.edu.tw` | `survey123` |

正式部署前務必修改預設密碼與 `SECRET_KEY`。

## Docker

```powershell
Copy-Item .env.example .env
docker compose up --build
```

## AI 分析

在 `.env` 設定 `OPENAI_API_KEY` 後，後端會將彙總後的議題數據送至 OpenAI API 生成中英文摘要。系統不會把姓名、電子郵件或逐筆原始填答送往模型。

## 資料設計

核心資料表：

- `stakeholder_groups`：教師、職員、學生、校友及校外利害關係人
- `users`：帳號、角色與利害關係人類別
- `topics`：ESG 議題庫
- `survey_campaigns`：評估年度、狀態與雙軸門檻
- `survey_responses`：填答者、活動、開放題與提交時間
- `topic_scores`：每一議題的三項 1–5 分評分

重大性判定門檻預設為 3.5：

| 衝擊重大性 | 財務重大性 | 判定 |
| --- | --- | --- |
| 高 | 高 | 重大主題 |
| 高 | 低 | 揭露主題 |
| 低 | 高 | 風險主題 |
| 低 | 低 | 觀察主題 |

## 下一階段建議

1. 串接校務 SSO、邀請碼與匿名填答模式。
2. 建立議題庫、問卷活動與門檻的管理介面。
3. 增加利害關係人權重、I/R/O 評估依據與佐證附件。
4. 新增 Excel 原始資料、PDF 與完整永續報告書章節輸出。
5. 加入操作軌跡、版本控管與審核流程。

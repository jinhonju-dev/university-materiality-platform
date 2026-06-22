# University Materiality Platform

大學永續報告書利害關係人問卷與雙重重大性評估平台。第一階段已支援正式資料庫保存、登入/匿名邀請碼填答、防重複送出、草稿暫存、加權分析，以及 Word / Excel / CSV 匯出。第二階段已補上利害關係人權重管理、分群分析、E/S/G 篩選、矩陣 PNG 下載與管理者介面。第三階段已補上議題庫管理與問卷活動管理。

## 架構

- Frontend: Next.js，GitHub Pages 可部署 demo/static frontend，也可透過 `NEXT_PUBLIC_API_URL` 連到正式後端。
- Backend: FastAPI + SQLAlchemy。
- Database: PostgreSQL / Supabase PostgreSQL；本機可用 SQLite 開發。
- Export: `python-docx` 產生正式 `.docx`，`openpyxl` 產生正式 `.xlsx`。

## 第二階段：利害關係人權重與分群分析

- 管理者可於前端「利害關係人」頁面維護各類別權重、說明與啟用狀態。
- Dashboard 可依 E/S/G 類別與利害關係人類別篩選重大性矩陣。
- Dashboard 同時呈現未加權平均、加權平均與分群樣本數。
- 重大性矩陣支援 PNG 下載，Word/Excel 匯出會列出樣本數與權重。
- 後端管理 API：
  - `GET /api/admin/stakeholder-groups`
  - `POST /api/admin/stakeholder-groups`
  - `PATCH /api/admin/stakeholder-groups/{group_id}`

## 第三階段：議題庫與問卷活動管理

管理者前端已新增：

- 「議題庫」：新增、編輯、停用 E/S/G 議題，欄位包含議題代碼、中文名稱、英文名稱、類別、說明、GRI 對應、SDGs 對應、責任單位、管理方針、KPI、排序與啟用狀態。
- 「問卷活動」：建立年度問卷活動、設定起訖時間、重大性門檻、狀態與是否開放填答。
- 「邀請碼管理」：依問卷活動與利害關係人類別批次產生匿名一次性邀請碼。

後端管理 API：

- `GET /api/admin/topics`
- `POST /api/admin/topics`
- `PATCH /api/admin/topics/{topic_id}`
- `GET /api/admin/campaigns`
- `POST /api/admin/campaigns`
- `PATCH /api/admin/campaigns/{campaign_id}`
- `GET /api/admin/campaigns/{campaign_id}/invitations`
- `POST /api/admin/campaigns/{campaign_id}/invitations`

## 環境變數

根目錄可由 `.env.example` 複製為 `.env`。

```env
DATABASE_URL=postgresql+psycopg://materiality:materiality@db:5432/materiality
SECRET_KEY=replace-with-a-long-random-secret
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
FRONTEND_ORIGIN=https://your-org.github.io
EXTRA_CORS_ORIGINS=
SEED_DEMO_ACCOUNTS=false
BOOTSTRAP_ADMIN_EMAIL=admin@example.edu
BOOTSTRAP_ADMIN_PASSWORD=replace-with-temporary-password

NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_API_URL=https://your-api.example.com/api
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

正式版請保持 `SEED_DEMO_ACCOUNTS=false`，並用 `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` 建立初始管理者。密碼會以 PBKDF2 hash 保存。

## 資料庫 Schema

正式 schema 位於 `backend/schema.sql`，主要資料表：

- `stakeholder_groups`: 利害關係人類別、權重、啟用狀態。
- `users`: 管理者與登入填答者。
- `topics`: E/S/G 議題庫與 GRI、SDGs、責任單位、KPI 等欄位。
- `survey_campaigns`: 年度問卷活動、起訖、門檻。
- `invitation_codes`: 匿名一次性邀請碼。
- `survey_drafts`: 問卷暫存。
- `survey_responses`: 正式送出紀錄。
- `topic_scores`: 雙重重大性詳細評分與自動計算分數。
- `audit_logs`: 登入、送出、匯出等稽核紀錄。

## 本機測試

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements-dev.txt
cd ..
$env:TMP="$PWD\.tmp"; $env:TEMP="$PWD\.tmp"
.\backend\.venv\Scripts\python.exe -m pytest
```

Frontend:

```powershell
cd frontend
npm install
npm run typecheck
npm test
npm run build
```

## 本機啟動

Backend:

```powershell
cd backend
.\.venv\Scripts\uvicorn app.main:app --reload
```

Frontend:

```powershell
cd frontend
npm run dev
```

## GitHub Pages + 正式後端部署

1. 部署 PostgreSQL 或 Supabase PostgreSQL，設定 `DATABASE_URL`。
2. 部署 FastAPI 後端到 Render、Railway、Fly.io、Azure App Service 或自管主機。
3. 後端設定：
   - `FRONTEND_ORIGIN=https://<org>.github.io`
   - `SECRET_KEY` 使用長隨機值
   - `SEED_DEMO_ACCOUNTS=false`
   - 首次部署才設定 `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`
4. GitHub Pages frontend 設定：
   - demo showcase: `NEXT_PUBLIC_DEMO_MODE=true`
   - formal frontend: `NEXT_PUBLIC_DEMO_MODE=false`
   - `NEXT_PUBLIC_API_URL=https://<backend-domain>/api`
5. GitHub Actions 會執行 `npm install`、build、type check、test，再部署 Pages。

## Demo Mode 與 Production Mode

Demo mode:

- 使用前端內建示範資料。
- 可用示範帳號快速體驗。
- 問卷不永久保存。
- 匯出僅產生示範文字檔提示。

Production mode:

- 所有問卷送出寫入 PostgreSQL。
- 同一帳號或同一邀請碼只能送出一次。
- 管理者可匯出正式 `.xlsx`、去識別化 `.csv` 與 `.docx`。
- 不顯示預設帳密。
- CORS 依 `FRONTEND_ORIGIN` 限制正式前端網域。

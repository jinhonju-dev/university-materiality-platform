# University Materiality Platform

大學永續報告書利害關係人調查與雙重重大性評估平台。

本次第一階段聚焦正式問卷架構與帳號權限：保留 GitHub Pages 展示版，同時補上 Production Mode、三種管理者角色、公開關注度調查與專家邀請碼重大性評估。

## 系統模式

Demo Mode:

- 前端以 `NEXT_PUBLIC_DEMO_MODE=true` 啟用。
- 畫面會標示「展示模式」。
- 可使用展示資料與展示帳號。
- 不作為正式資料保存用途。

Production Mode:

- 後端以 `APP_MODE=production` 啟用。
- 不產生 demo 帳號。
- 不使用 `admin123` / `survey123` 等預設密碼。
- 問卷資料寫入後端資料庫。
- 第一個 `super_admin` 需用 `BOOTSTRAP_ADMIN_EMAIL` 與 `BOOTSTRAP_ADMIN_PASSWORD` 建立。

## 帳號權限

管理者角色：

- `super_admin`: 可建立、停用、重設管理者帳號，可查看 `audit_logs`，可管理全部問卷活動。
- `admin`: 可建立問卷活動、管理議題庫、產生專家邀請碼、查看結果與匯出報告。
- `reviewer`: 只能查看儀表板與下載報告，不可修改資料，不可產生邀請碼。

填答者不需要正式帳號。

## 兩階段問卷

Concern Survey:

- 路徑：`/survey/concern`
- 不需登入、不需邀請碼。
- 填答者自行選擇利害關係人類別。
- 對各永續議題評估關注程度 1-5 分。

Expert Materiality Assessment:

- 路徑：`/survey/expert`
- 必須使用邀請碼。
- 邀請碼只能由 `admin` / `super_admin` 產生。
- 一組邀請碼預設只能填答一次。
- 支援「不清楚」，後端以 `null` 保存。

## 新增或修改資料表

- `users.role`: 支援 `super_admin`、`admin`、`reviewer`、`respondent`。
- `invitation_codes.survey_type`: 預設 `expert`。
- `concern_survey_responses`
- `concern_survey_scores`
- `expert_assessment_responses`
- `expert_assessment_scores`
- `audit_logs`: 由 `super_admin` 查詢。

完整 PostgreSQL schema 見 `backend/schema.sql`。

## 新增或修改 API

系統與公開問卷：

- `GET /api/system/mode`
- `GET /api/public/survey-config`
- `POST /api/surveys/concern`
- `POST /api/surveys/expert`

管理者帳號與稽核：

- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/{user_id}`
- `POST /api/admin/users/{user_id}/reset-password`
- `GET /api/admin/audit-logs`

權限調整：

- `GET /api/analytics`
- `GET /api/reports/materiality.docx`
- `POST /api/reports/materiality.docx`
- `GET /api/exports/materiality-matrix.png`

以上報表/儀表板端點允許 `super_admin`、`admin`、`reviewer`。

## 本機測試

Backend:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```

Frontend:

```powershell
cd frontend
npm run lint
npm run typecheck
npm run build
```

GitHub Pages demo build:

```powershell
cd frontend
$env:NEXT_PUBLIC_DEMO_MODE="true"
$env:PAGES_BASE_PATH="/university-materiality-platform"
npm run build
```

## GitHub Pages 部署注意事項

- GitHub Pages 只能部署靜態前端。
- Demo showcase 使用 `NEXT_PUBLIC_DEMO_MODE=true`。
- 正式前端使用 `NEXT_PUBLIC_DEMO_MODE=false` 並設定：
  - `NEXT_PUBLIC_API_URL=https://<backend-domain>/api`
- `/survey/concern` 與 `/survey/expert` 是公開前端路徑，正式資料仍需寫入後端 API。

## 後端正式部署建議

- 使用 PostgreSQL 或 Supabase PostgreSQL。
- 設定：
  - `APP_MODE=production`
  - `SEED_DEMO_ACCOUNTS=false`
  - `SECRET_KEY=<long-random-secret>`
  - `DATABASE_URL=<postgres-url>`
  - `FRONTEND_ORIGIN=https://<github-pages-domain>`
  - `BOOTSTRAP_ADMIN_EMAIL=<first-super-admin-email>`
  - `BOOTSTRAP_ADMIN_PASSWORD=<temporary-strong-password>`
- 建立第一位 `super_admin` 後，請立即登入並重設正式密碼。
- Production Mode 不會建立 demo 帳號。

# Project: Smart Achievement Vault & Career Assistant (Kho Thành Tích Cá Nhân & Trợ Lý AI Thi Đua - KPI)

## Architecture
The system is refactored from an administrative multi-tier approval system into an individual-centric Achievement Vault and AI Career Assistant.

- **Frontend**: React 18 + Vite + Tailwind CSS + Axios + Lucide icons. Single-Page Application with public route `/cv/:slug` for external access.
- **Backend**: Express.js REST API (Node.js ESM) with modular domain architecture:
  - `achievements`: Personal vault with immediate `ACTIVE` status and AI Vision OCR extraction.
  - `ai`: Rule evaluator, Auto-Discovery ranking, Dossier ZIP packager (`archiver`), and unit-level scanning.
  - `kpi`: Roadmap generation from AI gap analysis into KPI goals.
  - `cv`: CV profile management, custom slugs, public sharing, 3 web templates, and custom Word (`.docx`) template engine (`docxtemplater` + `pizzip`).
  - `calendar`: Personal calendar integration with submission deadline reminders.
  - `organizations`: 3-level tree (Trường -> Khoa -> Bộ môn -> Thành viên) and role-based unit management.
- **Database**: Microsoft SQL Server with schema `app.*`, migration management under `database/sqlserver/migrations/`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Personal Achievement Vault with immediate `ACTIVE` status | Newly created achievements are immediately `ACTIVE` without administrative approval | M1, M2 | R1, Survey |
| 2 | AI Vision Auto-fill for Certificates | Extract achievement title, year, issuer, decision number from image/PDF via Vision API | M2, M4 | R1, Survey |
| 3 | AI Vision Graceful Fallback | Gentle notification and seamless manual input when no API key or AI failure occurs | M2, M4 | R1, Survey |
| 4 | AI Regulation Gap Analysis | Compare active achievements with regulation criteria, detailed breakdown of passed & missing | M2, M4 | R2, Survey |
| 5 | AI Auto-Discovery (Khám Ngược) | Scan all active regulations and rank feasible awards by match percentage | M2, M4 | R2, Survey |
| 6 | Dossier Packaging (.ZIP) | Export zip bundle of all matched evidence files with standardized names `01_[Name]_[Year].pdf` | M2, M4 | R2, Survey |
| 7 | AI Gap to KPI Roadmap Bridge | Transform missing criteria into personal KPI roadmap goals with target metrics | M3, M4 | R3, Survey |
| 8 | Calendar Reminder Integration | Friendly popup to schedule submission deadlines directly into personal calendar | M3, M4 | R3, Survey |
| 9 | Public CV with Custom Slug | Public URL `/cv/:slug` with fallback UUID, public/private toggle, privacy screen when off | M3, M4 | R4, Survey |
| 10 | Multi-template Web & Custom DOCX Export | 3 Web templates (Academic, Modern, Minimalist) + DOCX placeholder export (`docxtemplater` + `pizzip`) | M3, M4 | R4, Survey |
| 11 | 3-Level Organization Hierarchy | Clean hierarchy: Trường (LHU) -> Khoa (FIT/PHARM) -> Bộ môn (FIT_SE/FIT_CS) -> Thành viên | M1, M3 | R5, Survey |
| 12 | 4 Standard Roles | Standardized to `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`; decommission old approval flows | M1, M3, M4 | R5, Survey |
| 13 | Unit AI Scan & Reports | Department heads and Faculty leads scan members against regulations and export stats | M3, M4 | R5, Survey |
| 14 | Automated Test Suites & Live Verification | Unit & integration tests for DB, evaluator, auto-discovery, zip, cv, and end-to-end flows | M1, M5, E2E | R6, Survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database Layer & Migration | Migration `005_refactor_personal_vault_and_cv.sql`, status `ACTIVE`, 4 roles, 3-level org tree, `app.cv_profiles`, `app.calendar_reminders`, `ck_kpi_goals_source` with `AI_GAP`, verification scripts | none | DONE |
| M2 | Backend Core: Vault, AI & ZIP Packager | Install `docxtemplater`, `pizzip`, `archiver`. Immediate `ACTIVE` in achievement repo/permissions, `POST /achievements/ai-extract` with fallback, `criteriaEvaluator` supporting `ACTIVE` with `matchedRecords` + `missingCount`, `autoDiscoveryService`, `dossierPackagerService` | M1 | DONE |
| M3 | Backend Extended: KPI, CV, Calendar & Unit Scan | `POST /kpi/from-ai-gap`, `cvService` (slug, `is_public`, 3 web templates, custom docx upload & export), `calendarService` deadline reminders, `POST /organizations/units/:id/ai-scan` | M1, M2 | DONE |
| M4 | Frontend Modernization & Routing | Clean up routes in `AppRoutes.jsx` & `Sidebar.jsx`. Upgrade `Achievements.jsx` (active badge, AI Vision modal + fallback). Upgrade `AIForecast.jsx` (2 tabs, ZIP download, KPI gap transfer popup, calendar prompt). Upgrade `Kpi.jsx`, `CvEditor.jsx`, `PublicCv.jsx`, `Reports.jsx` | M2, M3 | DONE |
| M5 | Final Milestone: E2E Test Suite & Adversarial Hardening | Phase 1: 100% pass of E2E test suite published in `TEST_READY.md`. Phase 2: Adversarial coverage hardening (Tier 5) | M4, E2E Track | DONE |

## Interface Contracts

### 1. Achievements Vault & AI Vision
- `POST /api/v1/achievements/ai-extract`:
  - Request: `multipart/form-data` with field `file`.
  - Response (Success / Fallback):
    ```json
    {
      "success": true,
      "data": { "title": "...", "recognitionYear": 2025, "issueDate": "...", "issuer": "...", "decisionNumber": "..." } | null,
      "fallback": false | true,
      "message": "..."
    }
    ```
- `POST /api/v1/achievements`:
  - Sets `status = 'ACTIVE'`, default label "Sẵn sàng sử dụng".

### 2. AI Evaluator & Auto-Discovery
- `POST /api/v1/ai/evaluations/structured`:
  - Request: `{ "regulationId": 1, "asOfDate": "2026-11-12" }`
  - Response: `{ "isSatisfied": boolean, "criterionResults": [ { "criterionId": 1, "isSatisfied": boolean, "matchedRecords": [...], "missingCount": 0 } ] }`
- `POST /api/v1/ai/auto-discovery`:
  - Response: `{ "success": true, "data": [ { "regulationId": 1, "name": "...", "percentage": 100, "satisfiedCount": 4, "totalCount": 4, "deadline": "..." } ] }`
- `POST /api/v1/ai/export-dossier-zip`:
  - Request: `{ "regulationId": 1 }`
  - Response: Stream binary `application/zip`, attachment filename `Goi_Minh_Chung_[Name]_[Year].zip`. Files formatted as `01_[Title]_[Year].pdf`.

### 3. KPI Gap & Calendar
- `POST /api/v1/kpi/from-ai-gap`:
  - Request: `{ "regulationId": 1, "missingCriteria": [ { "code": "...", "name": "...", "missingCount": 1, "unit": "..." } ] }`
  - Inserts `app.kpi_goals` with `source = 'AI_GAP'`, `source_note = '...'`.
- `POST /api/v1/me/calendar/reminder`:
  - Request: `{ "title": "Hạn nộp hồ sơ ...", "deadlineDate": "...", "regulationId": 1 }`
  - Inserts into `app.calendar_reminders` and `app.personal_calendar_events`.

### 4. CV Profiles & Public Route
- `GET /api/v1/public/cv/:slug`:
  - Unauthenticated access. Look up by slug, fallback to user_id / uuid.
  - If `is_public = 0`: returns `{ "isPublic": false, "message": "Hồ sơ đang ở chế độ riêng tư" }`.
  - If `is_public = 1`: returns full CV data with selected active achievements and template ID.
- `GET /api/v1/me/cv/export-docx`:
  - Renders Word template with `docxtemplater` + `pizzip`, returns binary `.docx`.

### 5. Unit Management & AI Scan
- `POST /api/v1/organizations/units/:id/ai-scan`:
  - Request: `{ "regulationId": 1 }`
  - Authorized: `DEPARTMENT_HEAD` (department members), `FACULTY_LEAD` (all faculty members), `ADMIN`.
  - Response: `{ "unitId": 1, "regulationId": 1, "results": [ { "userId": 1, "fullName": "...", "percentage": 100, "isEligible": true, "matched": [...], "missing": [...] } ] }`

## Code Layout
- `database/sqlserver/migrations/`: SQL migration files (`001` through `005_refactor_personal_vault_and_cv.sql`).
- `database/sqlserver/`: verification and test runner scripts (`verify-live.mjs`, `verify-refactor.mjs`).
- `backend/src/modules/`:
  - `achievements/`: `achievementService.js`, `achievementRepository.js`, `achievementAiIngestService.js`, `achievementRoutes.js`, `achievementPermissions.js`.
  - `ai/`: `criteriaEvaluator.js`, `autoDiscoveryService.js`, `dossierPackagerService.js`, `aiRoutes.js`, `aiService.js`.
  - `kpi/`: `kpiService.js`, `kpiRepository.js`, `kpiRoutes.js`.
  - `cv/`: `cvService.js`, `cvRoutes.js`, `cvSchemas.js`.
  - `calendar/`: `calendarService.js`, `calendarRoutes.js`.
  - `organizations/`: `organizationService.js`, `organizationRoutes.js`.
- `backend/tests/`: unit and integration tests.
- `frontend/src/`:
  - `routes/AppRoutes.jsx`: application route map.
  - `components/common/Sidebar.jsx`: primary navigation bar.
  - `pages/`: `Achievements.jsx`, `AIForecast.jsx`, `Kpi.jsx`, `CvEditor.jsx`, `PublicCv.jsx`, `Calendar.jsx`, `Reports.jsx`.
- `tests/e2e/`: requirement-driven E2E tests created by the E2E Testing Track (COMPLETE: 213 test items across Tiers 1-4, published in TEST_READY.md).

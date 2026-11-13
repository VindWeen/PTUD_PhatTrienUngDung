# Scope: Milestone 3 — Backend Extended Modules (KPI, CV, Calendar & Unit AI Scan)

## Architecture
- `kpi`: Bridge AI gap analysis into personal KPI goals (`POST /api/v1/kpi/from-ai-gap`) inserting into `app.kpi_goals` with `source = 'AI_GAP'`.
- `cv`: CV Profile management, public custom slug `/api/v1/public/cv/:slug` with UUID fallback and `is_public` toggle, 3 web templates (Academic, Modern, Minimalist), and DOCX export with `docxtemplater` + `pizzip` (`GET /api/v1/me/cv/export-docx`).
- `calendar`: Personal calendar integration with submission deadline reminders (`POST /api/v1/me/calendar/reminder`).
- `organizations`: 3-level organization hierarchy (Trường -> Khoa -> Bộ môn -> Thành viên) and unit AI scan (`POST /api/v1/organizations/units/:id/ai-scan`) for `DEPARTMENT_HEAD`, `FACULTY_LEAD`, and `ADMIN`.
- Comprehensive automated test suites in `backend/tests/` validating all M3 endpoints and edge cases.

## Feature Inventory
| # | Feature | Description | Milestone | Status |
|---|---------|-------------|-----------|--------|
| 7 | AI Gap to KPI Roadmap Bridge | Transform missing criteria into personal KPI roadmap goals with target metrics | M3 | DONE |
| 8 | Calendar Reminder Integration | Friendly popup to schedule submission deadlines directly into personal calendar | M3 | DONE |
| 9 | Public CV with Custom Slug | Public URL `/cv/:slug` with fallback UUID, public/private toggle, privacy screen when off | M3 | DONE |
| 10 | Multi-template Web & Custom DOCX Export | 3 Web templates (Academic, Modern, Minimalist) + DOCX placeholder export (`docxtemplater` + `pizzip`) | M3 | DONE |
| 11 | 3-Level Organization Hierarchy | Clean hierarchy: Trường -> Khoa -> Bộ môn -> Thành viên | M3 | DONE |
| 12 | 4 Standard Roles | Standardized to `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN` | M3 | DONE |
| 13 | Unit AI Scan & Reports | Department heads and Faculty leads scan members against regulations and export stats | M3 | DONE |
| 14 | Automated Test Suites | Unit and integration test suites validating KPI bridge, CV slug & docx, Calendar reminders, Unit AI Scan | M3 | DONE |

## Status: DONE (Gate PASS)
- Iteration 1: FAIL (Forensic audit detected unparsed OpenXML loop delimiters and live SQL column errors)
- Iteration 2 (Remediation): **PASS**
  - Worker 2: DONE (100% tests passing on live SQL Server DB and unit suites)
  - Reviewer 1 (`reviewer_r2_1`): **APPROVE**
  - Reviewer 2 (`reviewer_r2_2`): **APPROVE**
  - Challenger 1 (`challenger_r2_1`): **APPROVE**
  - Challenger 2 (`challenger_r2_2`): **APPROVE**
  - Forensic Auditor (`auditor_r2_1`): **CLEAN**

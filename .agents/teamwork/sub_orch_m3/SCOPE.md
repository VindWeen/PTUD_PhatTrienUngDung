# Scope: Milestone 3: Backend Extended Modules (KPI, CV, Calendar & Unit AI Scan)

## Architecture
- `kpi`: Bridge AI gap analysis into personal KPI goals (`POST /api/v1/kpi/from-ai-gap`) inserting into `app.kpi_goals` with `source = 'AI_GAP'`.
- `cv`: CV Profile management, public custom slug `/api/v1/public/cv/:slug` with UUID fallback and `is_public` toggle, 3 web templates (Academic, Modern, Minimalist), and DOCX export with `docxtemplater` + `pizzip` (`GET /api/v1/me/cv/export-docx`).
- `calendar`: Personal calendar integration with submission deadline reminders (`POST /api/v1/me/calendar/reminder`).
- `organizations`: 3-level organization hierarchy (Trường -> Khoa -> Bộ môn -> Thành viên) and unit AI scan (`POST /api/v1/organizations/units/:id/ai-scan`) for `DEPARTMENT_HEAD`, `FACULTY_LEAD`, and `ADMIN`.
- Automated test suites for all endpoints and business logic.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 7 | AI Gap to KPI Roadmap Bridge | Transform missing criteria into personal KPI roadmap goals with target metrics | M3 | R3, Survey |
| 8 | Calendar Reminder Integration | Friendly popup to schedule submission deadlines directly into personal calendar | M3 | R3, Survey |
| 9 | Public CV with Custom Slug | Public URL `/cv/:slug` with fallback UUID, public/private toggle, privacy screen when off | M3 | R4, Survey |
| 10 | Multi-template Web & Custom DOCX Export | 3 Web templates (Academic, Modern, Minimalist) + DOCX placeholder export (`docxtemplater` + `pizzip`) | M3 | R4, Survey |
| 11 | 3-Level Organization Hierarchy | Clean hierarchy: Trường -> Khoa -> Bộ môn -> Thành viên | M3 | R5, Survey |
| 12 | 4 Standard Roles | Standardized to `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN` | M3 | R5, Survey |
| 13 | Unit AI Scan & Reports | Department heads and Faculty leads scan members against regulations and export stats | M3 | R5, Survey |
| 14 | Automated Test Suites | Unit and integration test suites validating KPI bridge, CV slug & docx, Calendar reminders, Unit AI Scan | M3 | R6, Survey |

## Interface Contracts
- Refer to `PROJECT.md` § Interface Contracts:
  - 3. KPI Gap & Calendar: `POST /api/v1/kpi/from-ai-gap`, `POST /api/v1/me/calendar/reminder`
  - 4. CV Profiles & Public Route: `GET /api/v1/public/cv/:slug`, `GET /api/v1/me/cv/export-docx`, `PUT /api/v1/me/cv/profile`
  - 5. Unit Management & AI Scan: `POST /api/v1/organizations/units/:id/ai-scan`

# Scope: Milestone 4 - Frontend UI Modernization & Routing

## Architecture
Modernize the React 18 + Vite + Tailwind CSS Single-Page Application (SPA) to fully support the Smart Achievement Vault & Career Assistant system, retiring legacy administrative approval/council/paperwork workflows and empowering individual educators, department heads, faculty leads, and admins.

### Target Module Boundaries
- `frontend/src/pages/Achievements.jsx`: Achievement Vault UI with instant `ACTIVE` status badge, AI Vision certificate scanner modal, and graceful error fallback.
- `frontend/src/pages/AIForecast.jsx`: Two-tab AI evaluation & exploration interface ("Khám theo quy chế" + "Khám ngược tiềm năng / Auto-Discovery"), dossier ZIP export, and KPI roadmap transfer modal with optional Calendar reminder sync.
- `frontend/src/pages/Kpi.jsx`: KPI goal listing highlighting `AI_GAP` source and target metrics.
- `frontend/src/pages/Calendar.jsx`: Personal calendar displaying synchronized award deadlines and reminder events.
- `frontend/src/pages/CvEditor.jsx`: Profile CV customization (custom slug, UUID fallback, `is_public` toggle, 3 templates: Academic/Modern/Minimalist, and Word `.docx` download).
- `frontend/src/pages/PublicCv.jsx`: Public CV route `/cv/:slug` accessible without authentication, rendering complete CV or polite privacy screen if `is_public = 0`.
- `frontend/src/pages/Reports.jsx`: Organization unit AI scan interface for Department Heads and Faculty Leads with exportable statistics.
- `frontend/src/routes/AppRoutes.jsx`: Streamlined route configuration removing legacy paperwork/council pages, supporting standard 4 roles and public `/cv/:slug`.
- `frontend/src/components/common/Sidebar.jsx`: Modernized navigation menu reflecting the 4 standard roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`).

## Feature Inventory for Milestone 4
| # | Feature | Target Files | Requirements Addressed |
|---|---------|--------------|------------------------|
| 1 | Personal Achievement Vault with `ACTIVE` badge | `Achievements.jsx` | R1 |
| 2 | AI Vision OCR Modal + Graceful Fallback | `Achievements.jsx`, `api/` | R1 |
| 3 | AI Rule Evaluation Tab (Khám theo quy chế) | `AIForecast.jsx` | R2 |
| 4 | Auto-Discovery Tab (Khám ngược tiềm năng) | `AIForecast.jsx` | R2 |
| 5 | Dossier Packaging Download (.ZIP) | `AIForecast.jsx` | R2 |
| 6 | AI Gap to KPI Transfer Modal + Calendar Sync | `AIForecast.jsx`, `Kpi.jsx`, `Calendar.jsx` | R3 |
| 7 | CV Profile Editor (Slug, 3 Templates, DOCX export) | `CvEditor.jsx` | R4 |
| 8 | Public CV Page (`/cv/:slug`) + Privacy Screen | `PublicCv.jsx`, `AppRoutes.jsx` | R4 |
| 9 | Modernized Navigation & Route Cleanup | `Sidebar.jsx`, `AppRoutes.jsx` | R5 |
| 10 | Organization Unit AI Scan & Reports | `Reports.jsx` | R5 |
| 11 | Vite Build & Automated Test Suite | `frontend/`, `tests/` | R6 |

## Milestones & Iteration Plan
| Step | Action | Status |
|------|--------|--------|
| Step 1 | 3 Explorers inspect frontend files and plan component updates | DONE |
| Step 2 | Worker implements UI modernizations, route cleanups, and tests | DONE |
| Step 3 | 2 Reviewers independently verify UI/UX and API alignment | DONE (APPROVE) |
| Step 4 | 2 Challengers test edge cases, error fallbacks, public slugs, and downloads | DONE (APPROVE) |
| Step 5 | 1 Forensic Auditor verifies implementation integrity | DONE (CLEAN) |
| Step 6 | Gate check & final report | DONE (PASS) |

## Interface Contracts Reference
- `POST /api/v1/achievements/ai-extract` (multipart/form-data)
- `POST /api/v1/achievements` (status = ACTIVE)
- `POST /api/v1/ai/evaluations/structured` (`{ regulationId, asOfDate }`)
- `POST /api/v1/ai/auto-discovery` (ranks regulations by percentage)
- `POST /api/v1/ai/export-dossier-zip` (`{ regulationId }` -> zip download)
- `POST /api/v1/kpi/from-ai-gap` (`{ regulationId, missingCriteria }`)
- `POST /api/v1/me/calendar/reminder` (`{ title, deadlineDate, regulationId }`)
- `GET /api/v1/public/cv/:slug` (unauthenticated, public profile)
- `GET /api/v1/me/cv/export-docx` (docx download)
- `POST /api/v1/organizations/units/:id/ai-scan` (`{ regulationId }`)

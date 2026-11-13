# Scope: Milestone 2: Backend Core Modules (Vault, AI Vision, Evaluator, Auto-Discovery & Dossier ZIP) — Iteration 2

## Architecture
- `achievements`: Personal vault with immediate `ACTIVE` status and AI Vision OCR extraction (`achievementAiIngestService.js`).
- `ai`: Criteria evaluator supporting `ACTIVE` with `matchedRecords` + `missingCount`, `autoDiscoveryService.js`, `dossierPackagerService.js` (`archiver` zip stream).
- Dependencies: `docxtemplater`, `pizzip`, `archiver`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Personal Achievement Vault with immediate `ACTIVE` status | Newly created achievements are immediately `ACTIVE` without administrative approval | M2 | R1, Survey |
| 2 | AI Vision Auto-fill for Certificates | Extract achievement title, year, issuer, decision number from image/PDF via Vision API | M2 | R1, Survey |
| 3 | AI Vision Graceful Fallback | Gentle notification and seamless manual input when no API key or AI call fails | M2 | R1, Survey |
| 4 | AI Regulation Gap Analysis | Compare active achievements with regulation criteria, return matchedRecords & missingCount | M2 | R2, Survey |
| 5 | AI Auto-Discovery (Khám Ngược) | Scan all active regulations and rank feasible awards by match percentage | M2 | R2, Survey |
| 6 | Dossier Packaging (.ZIP) | Export zip bundle of all matched evidence files with standardized names 01_[Name]_[Year].pdf | M2 | R2, Survey |

## Iteration 2 Remediation Scope
1. `backend/src/modules/achievements/achievementRepository.js`: Change `deleteAchievement` and `restoreAchievement` to `AND status IN ('ACTIVE', 'DRAFT')`.
2. `backend/src/modules/achievements/achievementService.js`: Update `listActiveTypes` and `listAchievements` to support standard roles `MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`.
3. `backend/src/modules/ai/dossierPackagerService.js`: Synchronize with `autoDiscoveryService.js` by querying both `app.achievements` AND `app.award_records`. On archive stream error when `res.headersSent` is true, call `res.end()`.
4. `backend/tests/achievement-vault-active.test.js`: Add tests verifying deletion and restoration SQL logic on `ACTIVE` achievements.

## Milestones / Work Items
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Worker Remediation & Unit Tests | Implement 4 remediation items and run full backend test suite | none | DONE |
| 2 | Reviewer Dual Verification | 2 Reviewers independently verify changes, correctness & role permissions | M1 | DONE |
| 3 | Challenger Stress-Testing | 2 Challengers test adversarial edge cases | M1 | DONE |
| 4 | Forensic Integrity Audit | 1 Forensic Auditor verifies absence of cheating, facade or dummy code | M1 | DONE |
| 5 | Gate Check & Synthesis | Gate check in GATE_STATUS.md, write handoff.md, report to parent | M2, M3, M4 | DONE |

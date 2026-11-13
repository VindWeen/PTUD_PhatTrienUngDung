# Scope: Milestone 2: Backend Core Modules (Vault, AI Vision, Evaluator, Auto-Discovery & Dossier ZIP)

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

## Milestones / Work Items
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Dependencies & Environment | Install `docxtemplater pizzip archiver` and verify ESM imports | none | IN_PROGRESS |
| 2 | Achievement Vault Refactor | Immediate ACTIVE status, permission updates, decommission approval routes, AI Vision extraction with graceful fallback | Dependencies | PLANNED |
| 3 | AI Evaluator Refactor | Support ACTIVE status, return matchedRecords & missingCount | Dependencies | PLANNED |
| 4 | Auto-Discovery Service | Scan open regulations, compute % completion, rank descending | AI Evaluator | PLANNED |
| 5 | Dossier ZIP Packager | Stream ZIP with standardized filenames `01_[TenMinhChung]_[Nam].pdf` | AI Evaluator | PLANNED |
| 6 | Unit & Integration Test Suites | `achievement-vault-active.test.js`, `ai-criteria-active.test.js`, `ai-auto-discovery.test.js`, `dossier-packager-zip.test.js` | All above | PLANNED |

## Interface Contracts
- Refer to PROJECT.md § Interface Contracts.

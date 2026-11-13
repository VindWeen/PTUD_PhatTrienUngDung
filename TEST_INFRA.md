# Test Infrastructure & Specification: Smart Achievement Vault & Career Assistant

## 1. Test Philosophy

The testing strategy for the **Smart Achievement Vault & Career Assistant** (*Kho Thành Tích Cá Nhân & Trợ Lý AI Thi Đua - KPI*) is grounded on four foundational testing principles:

1. **Opaque-Box & Requirement-Driven**:
   Tests are derived strictly from the product requirements in `ORIGINAL_REQUEST.md` (R1 through R6) and interface contracts in `PROJECT.md`. Tests treat the system under test (SUT) through its public REST interfaces and business contracts, decoupled from transient implementation details (such as specific SQL queries or ORM models).

2. **Progressive Testability Across Tiers (Tiers 1–4)**:
   The harness is architected into four progressive evaluation tiers:
   - **Tier 1 (Feature Coverage)**: Validates nominal happy paths, standard schemas, and fundamental contracts for all 13 distinct system capabilities.
   - **Tier 2 (Boundary & Corner Cases)**: Exercises invalid inputs, edge-case parameters, rate limits, empty collections, missing API keys, oversized payloads, and unauthenticated/unauthorized access.
   - **Tier 3 (Cross-Feature Pairwise)**: Validates 2-factor combinatorial interactions between interconnected domains (e.g. Vault -> AI Vision, AI Evaluator -> KPI Bridge, KPI Bridge -> Calendar Reminder, Public CV -> Custom Slug -> DOCX Export).
   - **Tier 4 (Real-World Application Scenarios)**: Executes multi-step end-to-end user journeys mirroring authentic academic and institutional workflows.

3. **Systematic Test Design Techniques**:
   - **Category-Partition Method (CPM)**: Decomposes input domains into representative categories and partitions (e.g. valid roles, valid file MIME types, status enums).
   - **Boundary Value Analysis (BVA)**: Asserts boundary states (e.g. match percentages 0%, 99.9%, 100%; single-day deadlines, leap years, maximum string lengths for custom slugs).
   - **Pairwise Testing (All-Pairs)**: Ensures comprehensive 2-way interactions between distinct modules with minimal redundancy.
   - **Workload / Scenario Testing**: Exercises end-to-end user workflows spanning multiple subsystems under realistic operational state sequences.

4. **Deterministic & Dependency-Free Execution**:
   - Uses Node.js native test runner (`node --test`) and native `fetch` client to ensure zero third-party testing framework bloat.
   - Provides a resilient dual-mode harness (`testClient.js`): connects to a live server when running (`process.env.TEST_API_URL`), and provides a deterministic contract simulation mode (`TEST_MODE=mock`) when the live backend is undergoing offline build cycles, guaranteeing immediate contract validation and continuous gate checking.

---

## 2. Feature Inventory Mapping Table

The system comprises 13 distinct core features across the 6 major requirement areas (R1–R6). Every feature is systematically exercised across Tiers 1–4:

| # | Feature Name | Requirement Source | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Scenario) |
|---|--------------|--------------------|:----------------:|:-----------------:|:-----------------:|:-----------------:|
| 1 | Personal Achievement Vault (`ACTIVE` status) | R1 | 5 tests | 5 tests | ✓ | ✓ |
| 2 | AI Vision Auto-fill for Certificates | R1 | 5 tests | 5 tests | ✓ | ✓ |
| 3 | AI Vision Graceful Fallback (manual input) | R1 | 5 tests | 5 tests | ✓ | ✓ |
| 4 | AI Regulation Gap Analysis (passed & missing) | R2 | 5 tests | 5 tests | ✓ | ✓ |
| 5 | AI Auto-Discovery (rank open regulations by %) | R2 | 5 tests | 5 tests | ✓ | ✓ |
| 6 | Dossier Packaging .ZIP (standard naming) | R2 | 5 tests | 5 tests | ✓ | ✓ |
| 7 | AI Gap to KPI Roadmap Bridge | R3 | 5 tests | 5 tests | ✓ | ✓ |
| 8 | Calendar Reminder Integration (deadline popup) | R3 | 5 tests | 5 tests | ✓ | ✓ |
| 9 | Public CV with Custom Slug (`/cv/:slug`) | R4 | 5 tests | 5 tests | ✓ | ✓ |
| 10 | CV Web & Word (`.docx`) Template Export | R4 | 5 tests | 5 tests | ✓ | ✓ |
| 11 | 3-Level Organization Hierarchy (Trường -> Khoa -> Bộ môn) | R5 | 5 tests | 5 tests | ✓ | ✓ |
| 12 | 4 Standard Roles (`MEMBER`, `DEPARTMENT_HEAD`, `FACULTY_LEAD`, `ADMIN`) | R5 | 5 tests | 5 tests | ✓ | ✓ |
| 13 | Unit AI Scan & Reports | R5 | 5 tests | 5 tests | ✓ | ✓ |
| **Total** | **All 13 Features** | **R1–R6** | **65 tests** | **65 tests** | **15 tests** | **7 scenarios** |

Total Target Test Volume across Tiers: **152 tests**.

---

## 3. Test Architecture

### 3.1 Directory Layout
```
c:\DriveD\EverythingElse\LHU\PTUD_PhatTrienUngDung\
├── TEST_INFRA.md                           # This infrastructure specification
├── TEST_READY.md                           # Publication gate artifact upon completion
└── tests/
    └── e2e/
        ├── helpers/
        │   ├── testClient.js               # Lightweight fetch client with multi-role auth & mock fallback
        │   └── fixtures.js                 # Shared test data, OCR fixtures, regulations & org structures
        ├── runner.js                       # CLI test runner with structured markdown & console report
        ├── smoke.test.js                   # Harness verification smoke test
        ├── tier1-feature-coverage.test.js  # Tier 1: 65 feature tests (5 per feature)
        ├── tier2-boundary-corner.test.js   # Tier 2: 65 boundary & corner tests (5 per feature)
        ├── tier3-cross-feature.test.js     # Tier 3: 15 pairwise cross-feature integration tests
        └── tier4-application-scenarios.test.js # Tier 4: 7 end-to-end application scenarios
```

### 3.2 Execution Harness & Commands
- **Native Test Runner**:
  ```bash
  node --test tests/e2e/*.test.js
  ```
- **Unified Test Runner with Metrics Output**:
  ```bash
  node tests/e2e/runner.js
  ```
- **Selective Tier Execution**:
  ```bash
  node --test tests/e2e/tier1-feature-coverage.test.js
  node --test tests/e2e/tier2-boundary-corner.test.js
  node --test tests/e2e/tier3-cross-feature.test.js
  node --test tests/e2e/tier4-application-scenarios.test.js
  ```

### 3.3 Pass/Fail Semantics & Assertion Discipline
- Assertions use Node's native `node:assert/strict`.
- Every test assertion verifies explicit contract fields (HTTP status code, boolean flags, response payload schemas, record counts, and status values).
- No arbitrary sleeps or flakiness; async promises resolve predictably.
- Role-based tests ensure exact permission matrices:
  - `MEMBER`: Own vault, personal calendar, personal CV, personal KPI.
  - `DEPARTMENT_HEAD`: Member capabilities + department unit AI scan.
  - `FACULTY_LEAD`: Member capabilities + faculty-wide unit AI scan.
  - `ADMIN`: Global organization tree management and unrestricted audit view.

---

## 4. Real-World Application Scenarios (Tier 4)

Tier 4 exercises authentic user workflows combining multiple features into cohesive operational journeys:

| Scenario ID | Scenario Name | Primary Roles | Key Features Exercised | Expected Outcome |
|-------------|---------------|---------------|------------------------|------------------|
| **SC-01** | New Lecturer Vault Onboarding & AI OCR Auto-Fill | `MEMBER` | Feat 1, 2, 3 | Member uploads certificate PDF/image, AI extracts metadata into draft, member edits title and creates achievement with immediate `ACTIVE` status without approval. |
| **SC-02** | 100% Match Auto-Discovery & Instant Dossier ZIP Packaging | `MEMBER` | Feat 1, 4, 5, 6 | Member runs Auto-Discovery, discovers 100% match on "Chiến sĩ thi đua cấp cơ sở", views gap analysis (all passed), and exports numbered `.zip` dossier (`01_[Title]_[Year].pdf`). |
| **SC-03** | Regulation Gap Analysis & AI Gap to KPI Action Plan Bridge | `MEMBER` | Feat 4, 7 | Member checks eligibility for "Giảng viên Xuất sắc" (75% match, 1 article missing). System prompts gap-to-KPI transfer, creating `AI_GAP` goal in KPI Roadmap. |
| **SC-04** | Deadline Reminder Integration to Personal Calendar | `MEMBER` | Feat 7, 8 | During gap transfer, user confirms deadline popup ("Hạn nộp hồ sơ ngày 15/12"). Event is scheduled into personal calendar with notification timestamp. |
| **SC-05** | Public Career CV Custom Slug & DOCX Export Flow | `MEMBER`, Public Guest | Feat 9, 10 | Member sets slug `nguyen-van-an`, chooses Modern Web template, toggles `is_public = 1`. Guest loads `/cv/nguyen-van-an`. Member downloads formatted `.docx` CV bundle. |
| **SC-06** | Department & Faculty Lead Unit-wide AI Audit Scan | `DEPARTMENT_HEAD`, `FACULTY_LEAD` | Feat 11, 12, 13 | Head of Department of Software Engineering scans unit members for annual awards; Faculty Lead scans across all subordinate departments and exports statistics report. |
| **SC-07** | End-to-End Annual Award Campaign Lifecycle | `MEMBER`, `DEPARTMENT_HEAD`, `ADMIN` | Feat 1, 4, 5, 6, 7, 8, 11, 12, 13 | Full lifecycle: Admin verifies 3-level tree, Member logs achievement, runs Auto-Discovery, bridges gaps to KPI, exports dossier ZIP, and Department Head reviews unit eligibility. |

---

## 5. Coverage Thresholds & Target Metrics

To satisfy acceptance criteria and forensic audit standards, test coverage must strictly meet or exceed the following metrics:

| Testing Tier | Scope / Objective | Minimum Required Tests | Pass Rate Target |
|--------------|-------------------|:----------------------:|:----------------:|
| **Tier 1** | Nominal Feature Coverage (>=5 per feature) | 65 | 100% |
| **Tier 2** | Boundary & Corner Cases (>=5 per feature) | 65 | 100% |
| **Tier 3** | Pairwise Cross-Feature Interactions | 15 | 100% |
| **Tier 4** | Real-World Application Scenarios | 7 | 100% |
| **Total** | **Comprehensive E2E Suite** | **>= 152** | **100%** |

### Flakiness and Performance SLA
- Zero test skips without documented technical rationale.
- Individual tier execution time must be under 30 seconds in mock mode and under 120 seconds against live DB.
- Deterministic error messages for all failure modes to accelerate diagnosis and maintenance.

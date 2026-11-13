# ESLint Audit & Fix Strategy Analysis — Milestone 4 (Iteration 2)

**Author**: Explorer 3 (`explorer_m4_3_iter2`)  
**Date**: 2026-11-13  
**Target**: `frontend/src`  

---

## 1. Executive Summary

Running `npm --prefix frontend run lint` produces **5 problems (2 errors, 3 warnings)** and exits with code 1.
The failures break continuous integration and lint verification gates.

The problems break down into two categories:
1. **Syntax / JSX Entities Errors (Exit code 1)**:
   - `frontend/src/pages/Calendar.jsx:418:63` — `react/no-unescaped-entities` (Unescaped quote `"`)
   - `frontend/src/pages/Calendar.jsx:418:81` — `react/no-unescaped-entities` (Unescaped quote `"`)
2. **React Hooks Dependency Warnings (Non-zero warnings)**:
   - `frontend/src/pages/AIForecast.jsx:96:6` — `react-hooks/exhaustive-deps` (Missing `selectedRegulationId`)
   - `frontend/src/pages/Achievements.jsx:188:6` — `react-hooks/exhaustive-deps` (Unnecessary outer scope dependencies `actionModalOpen`, `targetAchievement.achievementId`, `targetAchievement.version`)
   - `frontend/src/pages/Reports.jsx:131:6` — `react-hooks/exhaustive-deps` (Missing `scanRegulationId` and `scanUnitId`)

Resolving all 4 files yields a **100% clean lint pass with 0 errors and 0 warnings**.

---

## 2. Detailed Findings & Root Cause Analysis

### Finding 1: `Calendar.jsx` — Unescaped JSX Quotes (2 Errors)
- **Location**: `frontend/src/pages/Calendar.jsx`, line 418
- **Current code**:
  ```jsx
  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
    Chưa có hạn nộp nào được nhắc nhở. Khi chạy "Khám theo quy chế" và chuyển tiêu chí thiếu thành mục tiêu KPI, bạn có thể chọn thêm vào lịch nhắc nhở tại đây.
  </p>
  ```
- **Root Cause**:
  In React JSX, unescaped double quotes `"` within string literal children are parsed as potential attribute boundaries or raw entities. ESLint's `react/no-unescaped-entities` rule enforces escaping raw double quotes to prevent HTML entity ambiguity.
- **Remediation**:
  Replace `"Khám theo quy chế"` with `&ldquo;Khám theo quy chế&rdquo;` (or `&quot;Khám theo quy chế&quot;`).
  Using `&ldquo;` and `&rdquo;` provides typographical smart quotes (“ ”) and complies with ESLint.

---

### Finding 2: `AIForecast.jsx` — React Hook Missing Dependency (1 Warning)
- **Location**: `frontend/src/pages/AIForecast.jsx`, line 96
- **Current code**:
  ```javascript
  // Load regulations list
  useEffect(() => {
    let active = true;
    setLoadingRegulations(true);
    regulationsApi.listDocuments()
      .then(res => {
        if (!active) return;
        const docs = Array.isArray(res) ? res : res?.items || res?.data || [];
        setRegulations(docs);
        if (docs.length && !selectedRegulationId) {
          setSelectedRegulationId(String(docs[0].document_id || docs[0].id));
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setLoadingRegulations(false); });
    return () => { active = false; };
  }, []);
  ```
- **Root Cause**:
  Line 89 reads `!selectedRegulationId` from outer state scope. ESLint expects `selectedRegulationId` in the dependency array.
  However, adding `selectedRegulationId` to `[]` would cause `listDocuments()` to re-fetch on every user selection change, which is an anti-pattern.
- **Remediation**:
  Use functional state update:
  ```javascript
  if (docs.length) {
    setSelectedRegulationId(curr => curr || String(docs[0].document_id || docs[0].id));
  }
  ```
  This eliminates reading `selectedRegulationId` in the effect closure. `react-hooks/exhaustive-deps` warning disappears completely without causing extra network requests.

---

### Finding 3: `Reports.jsx` — React Hook Missing Dependencies (1 Warning)
- **Location**: `frontend/src/pages/Reports.jsx`, line 131
- **Current code**:
  ```javascript
  useEffect(() => {
    if (!canScanUnit) return;
    regulationsApi.listDocuments()
      .then(res => {
        const docs = Array.isArray(res) ? res : res?.items || res?.data || [];
        setRegulationsList(docs);
        if (docs.length && !scanRegulationId) {
          setScanRegulationId(String(docs[0].document_id || docs[0].id));
        }
      })
      .catch(() => {});

    organizationsApi.list()
      .then(res => {
        const orgs = Array.isArray(res) ? res : res?.items || res?.data || [];
        setAllUnits(orgs);
        if (orgs.length && !scanUnitId) {
          setScanUnitId(String(orgs[0].unit_id || orgs[0].organization_unit_id || orgs[0].id));
        }
      })
      .catch(() => {});
  }, [canScanUnit]);
  ```
- **Root Cause**:
  Lines 116 (`!scanRegulationId`) and 126 (`!scanUnitId`) read state variables directly from the component scope.
  Adding them to `[canScanUnit]` would cause re-fetching when selecting options.
- **Remediation**:
  Convert both to functional state updaters:
  ```javascript
  if (docs.length) {
    setScanRegulationId(curr => curr || String(docs[0].document_id || docs[0].id));
  }
  ```
  and
  ```javascript
  if (orgs.length) {
    setScanUnitId(curr => curr || String(orgs[0].unit_id || orgs[0].organization_unit_id || orgs[0].id));
  }
  ```
  This eliminates reading `scanRegulationId` and `scanUnitId` inside the effect closure. The dependency array `[canScanUnit]` is preserved cleanly with 0 warnings.

---

### Finding 4: `Achievements.jsx` — Stale Outer Scope Dependencies & Runtime Crash (1 Warning & 1 Fatal Bug)
- **Location**: `frontend/src/pages/Achievements.jsx`, lines 176–184 and line 188
- **Current code**:
  ```javascript
  176:       if (actionModalOpen && targetAchievement?.achievementId) {
  177:         try {
  178:           const target = await achievementsApi.getById(targetAchievement.achievementId, true);
  179:           if (active && String(target.version) !== String(targetAchievement.version)) {
  180:             setActionConflict(true);
  181:             setActionError('Hồ sơ vừa được cập nhật. Đóng hộp thao tác và chọn lại thao tác từ trạng thái mới.');
  182:           }
  183:         } catch (err) { if (active) setActionError(err.message); }
  184:       }
  185:     };
  186:     window.addEventListener('workflow-updated', refresh);
  187:     return () => { active = false; window.removeEventListener('workflow-updated', refresh); };
  188:   }, [loadData, detailModalOpen, selectedAchievement?.achievementId, actionModalOpen, targetAchievement?.achievementId, targetAchievement?.version]);
  ```
- **Root Cause**:
  When the decommissioned administrative approval modal was removed, the state variables `actionModalOpen` and `targetAchievement` were deleted, but lines 176–184 and line 188 were left behind.
  In runtime, evaluating `actionModalOpen` in line 188 throws `Uncaught ReferenceError: actionModalOpen is not defined`.
  In ESLint, it warns: `React Hook useEffect has unnecessary dependencies: 'actionModalOpen', 'targetAchievement.achievementId', and 'targetAchievement.version'`.
- **Remediation**:
  1. Delete lines 176–184 completely.
  2. Update line 188 to:
     ```javascript
     }, [loadData, detailModalOpen, selectedAchievement?.achievementId]);
     ```

---

## 3. Projected Verification Result

Once these four fixes are applied:
- `Calendar.jsx`: 0 errors, 0 warnings
- `AIForecast.jsx`: 0 errors, 0 warnings
- `Reports.jsx`: 0 errors, 0 warnings
- `Achievements.jsx`: 0 errors, 0 warnings
- Total ESLint problems: **0 problems (0 errors, 0 warnings)**
- `npm --prefix frontend run lint` exit code: **0**

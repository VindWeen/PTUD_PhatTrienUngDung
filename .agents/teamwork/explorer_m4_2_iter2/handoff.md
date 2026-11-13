# HARD HANDOFF REPORT — Explorer 2: Milestone 4 (Iteration 2)
**Investigation**: Gap-to-KPI Schema Contract & Empty Missing Criteria Guard in `AIForecast.jsx`  
**Explorer Agent ID**: `explorer_m4_2_iter2`  
**Parent Agent ID**: `90556efc-f4ca-417f-a5c8-f22148a2d853`  
**Timestamp**: `2026-11-13T02:57:00Z`  
**Target File**: `frontend/src/pages/AIForecast.jsx`  

---

## 1. Observation

### 1.1 Backend Zod Schema Contracts (`backend/src/modules/kpi/kpiSchemas.js`)
Lines 81-110 in `backend/src/modules/kpi/kpiSchemas.js`:
```javascript
export const aiGapCriterionSchema = z
  .object({
    code: text(80).transform((v) => v.toUpperCase()),
    name: text(255),
    missingCount: z.coerce.number().finite().min(0).default(1),
    unit: z.string().trim().max(80).optional().default("tiêu chí"),
    periodStart: date.optional(),
    periodEnd: date.optional(),
    plan: z.string().trim().max(4000).optional(),
  })
  .strict()
  .refine(
    (v) => !v.periodStart || !v.periodEnd || v.periodEnd >= v.periodStart,
    "Kỳ kết thúc phải sau kỳ bắt đầu",
  );

export const fromAiGapSchema = z
  .object({
    regulationId: id,
    missingCriteria: z
      .array(aiGapCriterionSchema)
      .min(1, "Danh sách tiêu chí thiếu không được rỗng"),
    periodStart: date.optional(),
    periodEnd: date.optional(),
    plan: z.string().trim().max(4000).optional(),
  })
  .strict()
  .refine(
    (v) => !v.periodStart || !v.periodEnd || v.periodEnd >= v.periodStart,
    "Kỳ kết thúc phải sau kỳ bắt đầu",
  );
```
- Line 3: `id = z.coerce.number().int().positive().safe()`.
- Line 17: `text = (max) => z.string().trim().min(1).max(max)`.
- Line 61 & 91: Both `aiGapCriterionSchema` and `fromAiGapSchema` apply `.strict()`.
- Unrecognized keys at root or within `missingCriteria` array elements cause `safeParse` to immediately fail with `unrecognized_keys`.

### 1.2 Frontend Request Payload Construction (`frontend/src/pages/AIForecast.jsx`)
Lines 229-245 in `frontend/src/pages/AIForecast.jsx`:
```javascript
  const handleConfirmGapTransfer = async () => {
    if (!gapRegulation) return;
    setGapTransferring(true);
    try {
      const payload = {
        regulationId: gapRegulation.regulationId || gapRegulation.documentId || gapRegulation.id,
        missingCriteria: gapMissingCriteria.map(c => ({
          criterionId: c.criterionId || c.criterion_id || c.criteriaId,
          code: c.criterionCode || c.code,
          name: c.name || c.criterionName,
          missingCount: c.missingCount || 1,
          measureUnit: c.thresholdMetric?.unit || c.unit || 'tiêu chí',
        })),
        autoTransfer: true,
      };

      const kpiRes = await kpiApi.createFromAiGap(payload);
```
Direct mismatches observed:
1. `autoTransfer: true` is attached at the root of `payload`. `fromAiGapSchema` has `.strict()` and does not declare `autoTransfer`.
2. `criterionId` is attached to every element in `missingCriteria`. `aiGapCriterionSchema` has `.strict()` and does not declare `criterionId`.
3. `measureUnit` is attached instead of `unit`. `aiGapCriterionSchema` expects property name `unit`, while rejecting `measureUnit` as an unrecognized key.

### 1.3 Empirical Reproduction
Running `node --test backend/tests/challenger-m4-empirical.test.js`:
- Test `Gap-to-KPI CONTRACT BUG REPRODUCTION: AIForecast.jsx payload fails Zod strict validation` confirms that parsing `payload` with `fromAiGapSchema.safeParse` produces `success: false` with 2 unrecognized key errors (`autoTransfer` at root; `criterionId`, `measureUnit` at `missingCriteria[0]`).
- In production runtime, when an educator clicks "Xác nhận chuyển thành KPI", Express router `POST /api/v1/kpi/from-ai-gap` invokes `kpiService.createFromAiGap`, which calls `parse(fromAiGapSchema, raw)`. Because of the extra keys, it throws `ValidationError: Dữ liệu KPI không hợp lệ`, triggering HTTP 400 and showing an alert error, completely blocking gap transfer.

### 1.4 Modal Submit Guard Defect (`frontend/src/pages/AIForecast.jsx`)
Lines 936-941 in `frontend/src/pages/AIForecast.jsx`:
```jsx
<button
  type="button"
  disabled={gapTransferring}
  onClick={handleConfirmGapTransfer}
  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium transition disabled:opacity-50 flex items-center gap-1.5 shadow-soft-sm"
>
```
- The button only checks `disabled={gapTransferring}`.
- If `gapMissingCriteria` is empty (`gapMissingCriteria.length === 0`), the button remains clickable.
- Clicking it transmits `missingCriteria: []`, violating `.min(1, "Danh sách tiêu chí thiếu không được rỗng")` in `fromAiGapSchema`.
- In addition, the modal list lines 877-896 displays `"Danh sách 0 tiêu chí còn thiếu sẽ chuyển thành KPI:"` with an empty scrolling box without any helpful empty state feedback.

---

## 2. Logic Chain

1. *Premise*: Backend `fromAiGapSchema` and `aiGapCriterionSchema` enforce a strict Zod contract via `.strict()`.
2. *Observation*: The frontend `AIForecast.jsx` constructs an outgoing payload containing:
   - Root key `autoTransfer: true`
   - Child keys `criterionId` and `measureUnit` (instead of `unit`)
3. *Deduction*: When `kpiService.createFromAiGap` parses `raw` with `fromAiGapSchema`, Zod detects 3 illegal keys and rejects the input, throwing a `ValidationError`.
4. *Consequence*: The API returns HTTP 400 with message `"Dữ liệu KPI không hợp lệ"`. The educator cannot transfer unmet criteria into KPI goals.
5. *Premise*: `fromAiGapSchema` additionally requires `missingCriteria` array `.min(1)`.
6. *Observation*: `AIForecast.jsx` submit button does not disable when `gapMissingCriteria.length === 0`, and `handleConfirmGapTransfer` lacks an empty check.
7. *Deduction*: Submitting an empty criteria list sends `missingCriteria: []`, which triggers a backend 400 validation error.
8. *Conclusion*: Correcting `handleConfirmGapTransfer` payload mapping, adding defensive guards on empty criteria, and updating the modal button `disabled` state resolves both issues completely and restores end-to-end functionality.

---

## 3. Caveats

1. **Backend Schema Remains `.strict()`**: We keep the backend schema strict. The frontend is solely responsible for conforming to the established schema contract.
2. **Calendar Reminder Contract**: In `calendarService.js`, `createReminderSchema` expects `regulationId: idSchema.optional().nullable()`. We ensure `Number(gapRegulation.regulationId || gapRegulation.documentId || gapRegulation.id)` is cast as a valid number, avoiding NaN or non-numeric values.
3. **Empty String & Sanitization Fallbacks**: Criteria objects in `gapMissingCriteria` may come from either `currentResults` (Tab 1) or `discoveryList` (Tab 2). Code properties may be `criterionCode` or `code`, names may be `criterionName` or `name`. The fix provides safe trimming and sensible fallbacks (`GAP_${i + 1}`, `Tiêu chí ${code}`) capped at maximum schema lengths (80 and 255 characters).

---

## 4. Conclusion & Concrete Implementation Specification for Worker

### Exact Code Changes for `frontend/src/pages/AIForecast.jsx`

#### Change 1: Update `handleConfirmGapTransfer` (Lines 229-265)
**Target**:
```javascript
  const handleConfirmGapTransfer = async () => {
    if (!gapRegulation) return;
    setGapTransferring(true);
    try {
      const payload = {
        regulationId: gapRegulation.regulationId || gapRegulation.documentId || gapRegulation.id,
        missingCriteria: gapMissingCriteria.map(c => ({
          criterionId: c.criterionId || c.criterion_id || c.criteriaId,
          code: c.criterionCode || c.code,
          name: c.name || c.criterionName,
          missingCount: c.missingCount || 1,
          measureUnit: c.thresholdMetric?.unit || c.unit || 'tiêu chí',
        })),
        autoTransfer: true,
      };

      const kpiRes = await kpiApi.createFromAiGap(payload);

      // Optionally create calendar reminder
      if (gapAddReminder && gapDeadlineDate) {
        await calendarApi.createReminder({
          title: `Hạn nộp hồ sơ: ${gapRegulation.name || gapRegulation.title || 'Quy chế khen thưởng'}`,
          deadlineDate: gapDeadlineDate,
          regulationId: gapRegulation.regulationId || gapRegulation.documentId,
          description: `Lộ trình hoàn thiện ${gapMissingCriteria.length} tiêu chí còn thiếu để đạt danh hiệu.`,
        });
      }

      setGapSuccessNotice({
        message: `Đã chuyển thành công ${gapMissingCriteria.length} tiêu chí còn thiếu thành Mục tiêu KPI${gapAddReminder ? ' và thêm sự kiện vào Lịch cá nhân' : ''}!`,
      });
    } catch (err) {
      alert('Không thể chuyển thành KPI: ' + (err.message || 'Lỗi hệ thống'));
    } finally {
      setGapTransferring(false);
    }
  };
```

**Replacement**:
```javascript
  const handleConfirmGapTransfer = async () => {
    if (!gapRegulation || !gapMissingCriteria || gapMissingCriteria.length === 0) return;
    setGapTransferring(true);
    try {
      const regId = Number(gapRegulation.regulationId || gapRegulation.documentId || gapRegulation.id);
      if (!regId || Number.isNaN(regId) || regId <= 0) {
        alert('Không tìm thấy mã quy chế hợp lệ.');
        return;
      }

      const payload = {
        regulationId: regId,
        missingCriteria: gapMissingCriteria.map((c, i) => {
          const rawCode = (c.criterionCode || c.code || `GAP_${i + 1}`).trim();
          const rawName = (c.criterionName || c.name || `Tiêu chí ${rawCode}`).trim();
          const countVal = Number(c.missingCount) > 0 ? Number(c.missingCount) : 1;
          const unitVal = (c.thresholdMetric?.unit || c.unit || 'tiêu chí').trim();
          return {
            code: rawCode.slice(0, 80).toUpperCase(),
            name: rawName.slice(0, 255),
            missingCount: countVal,
            unit: unitVal.slice(0, 80),
          };
        }),
      };

      await kpiApi.createFromAiGap(payload);

      // Optionally create calendar reminder
      if (gapAddReminder && gapDeadlineDate) {
        await calendarApi.createReminder({
          title: `Hạn nộp hồ sơ: ${gapRegulation.name || gapRegulation.title || 'Quy chế khen thưởng'}`,
          deadlineDate: gapDeadlineDate,
          regulationId: regId,
          description: `Lộ trình hoàn thiện ${gapMissingCriteria.length} tiêu chí còn thiếu để đạt danh hiệu.`,
        });
      }

      setGapSuccessNotice({
        message: `Đã chuyển thành công ${gapMissingCriteria.length} tiêu chí còn thiếu thành Mục tiêu KPI${gapAddReminder ? ' và thêm sự kiện vào Lịch cá nhân' : ''}!`,
      });
    } catch (err) {
      alert('Không thể chuyển thành KPI: ' + (err.message || 'Lỗi hệ thống'));
    } finally {
      setGapTransferring(false);
    }
  };
```

---

#### Change 2: Update Modal Missing Criteria List & Empty Guard (Lines 876-896)
**Target**:
```jsx
                {/* Missing Criteria List */}
                <div className="space-y-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Danh sách {gapMissingCriteria.length} tiêu chí còn thiếu sẽ chuyển thành KPI:
                  </span>
                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                    {gapMissingCriteria.map((c, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 flex items-center justify-between gap-2"
                      >
                        <span className="font-medium text-slate-800 dark:text-white truncate">
                          {c.criterionCode || c.code ? `[${c.criterionCode || c.code}] ` : ''}{c.criterionName || c.name}
                        </span>
                        <span className="text-purple-700 dark:text-purple-300 font-bold text-[11px] shrink-0">
                          + {c.missingCount || 1} {c.thresholdMetric?.unit || c.unit || 'tiêu chí'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
```

**Replacement**:
```jsx
                {/* Missing Criteria List */}
                <div className="space-y-2">
                  {gapMissingCriteria.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs text-center">
                      <p className="font-semibold">Tất cả tiêu chí đã hoàn thành!</p>
                      <p className="text-[11px] mt-0.5 text-emerald-600 dark:text-emerald-400">Không có tiêu chí thiếu để chuyển thành KPI.</p>
                    </div>
                  ) : (
                    <>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Danh sách {gapMissingCriteria.length} tiêu chí còn thiếu sẽ chuyển thành KPI:
                      </span>
                      <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                        {gapMissingCriteria.map((c, i) => (
                          <div
                            key={i}
                            className="p-2.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 flex items-center justify-between gap-2"
                          >
                            <span className="font-medium text-slate-800 dark:text-white truncate">
                              {c.criterionCode || c.code ? `[${c.criterionCode || c.code}] ` : ''}{c.criterionName || c.name}
                            </span>
                            <span className="text-purple-700 dark:text-purple-300 font-bold text-[11px] shrink-0">
                              + {c.missingCount || 1} {c.thresholdMetric?.unit || c.unit || 'tiêu chí'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
```

---

#### Change 3: Update Modal Confirm Button Disabled State (Lines 936-942)
**Target**:
```jsx
                  <button
                    type="button"
                    disabled={gapTransferring}
                    onClick={handleConfirmGapTransfer}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium transition disabled:opacity-50 flex items-center gap-1.5 shadow-soft-sm"
                  >
```

**Replacement**:
```jsx
                  <button
                    type="button"
                    disabled={gapTransferring || !gapMissingCriteria || gapMissingCriteria.length === 0}
                    onClick={handleConfirmGapTransfer}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-soft-sm"
                  >
```

---

## 5. Verification Method

1. **Zod Strict Schema Test**:
   Execute Node test to verify that the normalized payload passes `fromAiGapSchema`:
   ```powershell
   node -e "const { fromAiGapSchema } = require('./backend/src/modules/kpi/kpiSchemas.js'); const payload = { regulationId: 1, missingCriteria: [{ code: 'CRIT_01', name: 'Hoàn thành NCKH', missingCount: 1, unit: 'đề tài' }] }; console.assert(fromAiGapSchema.safeParse(payload).success === true, 'Payload must pass'); console.log('PASS: fromAiGapSchema normalized payload accepted');"
   ```
2. **Empty missingCriteria Array Validation**:
   Verify that empty payload is rejected by backend schema:
   ```powershell
   node -e "const { fromAiGapSchema } = require('./backend/src/modules/kpi/kpiSchemas.js'); console.assert(fromAiGapSchema.safeParse({ regulationId: 1, missingCriteria: [] }).success === false); console.log('PASS: Empty missingCriteria rejected');"
   ```
3. **Frontend Test Suite**:
   Run full frontend test suite:
   ```powershell
   npm --prefix frontend test
   ```
4. **Vite Production Build**:
   Verify clean compilation and bundling:
   ```powershell
   npm --prefix frontend run build
   ```
5. **Challenger Empirical Tests**:
   Run adversarial suite:
   ```powershell
   node --test backend/tests/challenger-m4-empirical.test.js
   ```

**Invalidation Conditions**:
- If `autoTransfer`, `criterionId`, or `measureUnit` is sent to `POST /api/v1/kpi/from-ai-gap`.
- If the "Xác nhận chuyển thành KPI" button is clickable when `gapMissingCriteria` is empty.
- If Vite build fails with syntax or import errors.

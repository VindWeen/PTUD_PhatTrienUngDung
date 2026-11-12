// Align synthetic historical timestamps with recognition years. No status or authority is bypassed.
export async function alignRichHistory(q) {
  await q(`UPDATE h SET created_at=DATEADD(hour,CASE h.to_status WHEN 'SUBMITTED' THEN 24 WHEN 'VERIFIED' THEN 48 ELSE 60 END,a.created_at)
    FROM app.achievement_status_histories h JOIN app.achievements a ON a.achievement_id=h.achievement_id WHERE a.title LIKE 'DEMO-%';
    UPDATE s SET submitted_at=DATEADD(hour,24,a.created_at),created_at=DATEADD(hour,24,a.created_at)
    FROM app.achievement_submissions s JOIN app.achievements a ON a.achievement_id=s.achievement_id WHERE a.title LIKE 'DEMO-%';
    UPDATE v SET verified_at=DATEADD(hour,48,a.created_at)
    FROM app.achievement_verifications v JOIN app.achievements a ON a.achievement_id=v.achievement_id WHERE a.title LIKE 'DEMO-%';
    UPDATE e SET created_at=DATEADD(hour,1,a.created_at),updated_at=DATEADD(hour,1,a.created_at)
    FROM app.evidences e JOIN app.achievements a ON a.achievement_id=e.achievement_id WHERE a.title LIKE 'DEMO-%';
    UPDATE f SET uploaded_at=DATEADD(hour,2,a.created_at)
    FROM app.evidence_files f JOIN app.evidences e ON e.evidence_id=f.evidence_id JOIN app.achievements a ON a.achievement_id=e.achievement_id WHERE a.title LIKE 'DEMO-%';
    UPDATE f SET attached_at=s.submitted_at FROM app.submission_evidence_files f JOIN app.achievement_submissions s ON s.submission_id=f.submission_id JOIN app.achievements a ON a.achievement_id=s.achievement_id WHERE a.title LIKE 'DEMO-%';
    UPDATE a SET updated_at=CASE WHEN a.status='DRAFT' THEN DATEADD(hour,2,a.created_at) WHEN a.status='SUBMITTED' THEN DATEADD(hour,24,a.created_at) WHEN a.status='VERIFIED' THEN DATEADD(hour,48,a.created_at) ELSE DATEADD(hour,60,a.created_at) END FROM app.achievements a WHERE a.title LIKE 'DEMO-%';
    UPDATE d SET created_at=CONVERT(datetime2,d.decision_date) FROM app.award_decisions d WHERE d.decision_number LIKE 'DEMO-%';
    UPDATE r SET created_at=CONVERT(datetime2,d.decision_date),updated_at=DATEADD(hour,3,CONVERT(datetime2,d.decision_date)),recorded_at=CASE WHEN r.recorded_at IS NOT NULL THEN DATEADD(hour,2,CONVERT(datetime2,d.decision_date)) ELSE NULL END
    FROM app.award_records r JOIN app.award_decisions d ON d.decision_id=r.decision_id WHERE d.decision_number LIKE 'DEMO-%';
    UPDATE f SET uploaded_at=DATEADD(hour,1,CONVERT(datetime2,d.decision_date)) FROM app.award_decision_files f JOIN app.award_decisions d ON d.decision_id=f.decision_id WHERE d.decision_number LIKE 'DEMO-%';
    UPDATE h SET created_at=DATEADD(hour,CASE h.to_status WHEN 'DRAFT' THEN 0 WHEN 'RECORDED' THEN 2 ELSE 3 END,CONVERT(datetime2,d.decision_date)) FROM app.award_record_histories h JOIN app.award_records r ON r.record_id=h.record_id JOIN app.award_decisions d ON d.decision_id=r.decision_id WHERE d.decision_number LIKE 'DEMO-%';
    UPDATE p SET status='CLOSED' FROM app.award_periods p WHERE code LIKE 'DEMO-TD-%' AND end_date<CONVERT(date,SYSUTCDATETIME());`);
  // Each individual award must reference a verified achievement in the same recognition year.
  await q(`UPDATE x SET achievement_id=(SELECT TOP (1) a.achievement_id FROM app.achievements a WHERE a.lecturer_id=r.lecturer_id AND a.status='VERIFIED' AND a.recognition_year=r.recognition_year AND a.title LIKE 'DEMO-%' ORDER BY a.achievement_id)
    FROM app.award_record_achievements x JOIN app.award_records r ON r.record_id=x.record_id JOIN app.award_decisions d ON d.decision_id=r.decision_id
    WHERE d.decision_number LIKE 'DEMO-QD-%';`);
}

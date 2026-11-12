-- Preserve the approved application and exact submitted input behind a recorded award.
ALTER TABLE app.award_records
 ADD COLUMN application_id BIGINT REFERENCES app.award_applications(application_id),
 ADD COLUMN application_input_version INT,
 ADD CONSTRAINT fk_award_record_application_input FOREIGN KEY(application_id,application_input_version)
   REFERENCES app.award_application_inputs(application_id,input_version),
 ADD CONSTRAINT ck_award_record_application_input CHECK
   ((application_id IS NULL) = (application_input_version IS NULL));
-- A revoked award may be replaced; a draft or recorded award must be reused.
CREATE UNIQUE INDEX uq_award_records_application_active ON app.award_records(application_id)
 WHERE application_id IS NOT NULL AND status IN ('DRAFT','RECORDED');

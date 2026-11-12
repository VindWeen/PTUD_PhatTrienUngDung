-- Keep every submitted input immutable, including corrected resubmissions.
ALTER TABLE app.award_application_inputs
  DROP CONSTRAINT award_application_inputs_pkey,
  DROP CONSTRAINT award_application_inputs_input_version_check,
  ADD PRIMARY KEY (application_id, input_version),
  ADD CONSTRAINT award_application_inputs_input_version_check CHECK (input_version > 0);

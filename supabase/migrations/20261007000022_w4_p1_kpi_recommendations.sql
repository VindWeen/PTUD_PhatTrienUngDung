-- Express-only recommendations. No goal exists before explicit acceptance.
CREATE TABLE app.kpi_recommendations (
  recommendation_id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES app.evaluation_runs(run_id),
  criterion_id BIGINT NOT NULL REFERENCES app.award_criteria_versions(criteria_version_id),
  created_by BIGINT NOT NULL REFERENCES app.users(user_id),
  payload JSONB NOT NULL,
  provider_evidence JSONB NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','REJECTED')),
  goal_id BIGINT UNIQUE REFERENCES app.kpi_goals(goal_id),
  version BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((status='ACCEPTED') = (goal_id IS NOT NULL))
);
CREATE INDEX kpi_recommendations_run ON app.kpi_recommendations(run_id,created_at);
ALTER TABLE app.kpi_recommendations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.kpi_recommendations FROM PUBLIC,anon,authenticated;

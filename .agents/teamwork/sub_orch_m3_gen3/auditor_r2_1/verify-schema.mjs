import { query } from '../../../../backend/src/utils/dbHelper.js';

async function verifySchema() {
  const tables = [
    'users',
    'achievements',
    'award_criteria_versions',
    'lecturer_assignments',
    'lecturers',
    'cv_profiles',
    'calendar_reminders',
    'personal_calendar_events',
    'kpi_goals'
  ];

  for (const table of tables) {
    const res = await query(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = 'app' AND TABLE_NAME = $1
       ORDER BY ORDINAL_POSITION`,
      [table]
    );
    console.log(`=== TABLE app.${table} (${res.rows.length} columns) ===`);
    console.log(res.rows.map(r => `  ${r.COLUMN_NAME} (${r.DATA_TYPE}, nullable: ${r.IS_NULLABLE})`).join('\n'));
  }
}

verifySchema()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('ERROR verifying schema:', err);
    process.exit(1);
  });

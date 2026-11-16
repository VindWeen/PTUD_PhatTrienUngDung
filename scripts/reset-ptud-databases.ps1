param([switch]$Apply)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$targetNames = @(
    'LHU_Achievement_DB',
    'PTUD_AchievementDB',
    'PTUD_LHU',
    'PTUD_LHU_Demo',
    'PTUD_LHU_Demo_RestoreTest',
    'PTUD_LHU_Demo_RichRestoreTest',
    'PTUD_LHU_RestoreTest'
)
$newDatabase = 'PTUD_LHU'
$connection = [System.Data.SqlClient.SqlConnection]::new(
    'Server=localhost;Database=master;Integrated Security=True;TrustServerCertificate=True;Connect Timeout=10'
)

function Read-Rows([string]$Query) {
    $command = $connection.CreateCommand()
    try {
        $command.CommandText = $Query
        $table = [System.Data.DataTable]::new()
        $table.Load($command.ExecuteReader())
        foreach ($row in $table.Rows) {
            $item = [ordered]@{}
            foreach ($column in $table.Columns) { $item[$column.ColumnName] = $row[$column] }
            [pscustomobject]$item
        }
    } finally { $command.Dispose() }
}

function Execute-Sql([string]$Query) {
    $command = $connection.CreateCommand()
    try {
        $command.CommandTimeout = 120
        $command.CommandText = $Query
        [void]$command.ExecuteNonQuery()
    } finally { $command.Dispose() }
}

function Quote-Identifier([string]$Value) { '[' + $Value.Replace(']', ']]') + ']' }

try {
    $connection.Open()
    $before = @(Read-Rows 'SELECT name, state_desc FROM sys.databases WHERE database_id > 4 ORDER BY name;')
    $targets = @($before | Where-Object { $_.name -cin $targetNames })
    $unrelatedBefore = @($before | Where-Object { $_.name -cnotin $targetNames })
    Write-Output ('Local databases to remove: ' + (($targets | ForEach-Object name) -join ', '))
    Write-Output 'Replacement: PTUD_LHU, empty database; no schema migrations, seed or import.'
    if (-not $Apply) { Write-Output 'Preview only. Pass -Apply to execute the user-authorized reset.'; return }

    # Resolve only the existing app login; never print or copy credentials.
    $envFile = Join-Path $projectRoot 'backend/.env'
    $envText = [System.IO.File]::ReadAllText($envFile)
    $loginMatch = [regex]::Match($envText, '(?m)^\s*DB_USER\s*=\s*([^\r\n]+)')
    if (-not $loginMatch.Success) { throw 'DB_USER missing; refusing reset without an application login.' }
    $appLogin = $loginMatch.Groups[1].Value.Trim().Trim('"').Trim("'")
    if ($appLogin -notmatch '^[A-Za-z0-9_]+$') { throw 'Unexpected application login name.' }
    $loginCheck = $connection.CreateCommand()
    try {
        $loginCheck.CommandText = 'SELECT COUNT(*) FROM sys.server_principals WHERE name=@login AND type IN (''S'',''U'');'
        [void]$loginCheck.Parameters.AddWithValue('@login', $appLogin)
        if ([int]$loginCheck.ExecuteScalar() -ne 1) { throw 'Existing application login not found.' }
    } finally { $loginCheck.Dispose() }

    foreach ($database in $targets) {
        if ($database.name -cnotin $targetNames) { throw 'Database is outside explicit reset allowlist.' }
        $identifier = Quote-Identifier $database.name
        Execute-Sql "ALTER DATABASE $identifier SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE $identifier;"
        Write-Output ('Removed ' + $database.name)
    }

    Execute-Sql ('CREATE DATABASE ' + (Quote-Identifier $newDatabase) + ';')
    $loginIdentifier = Quote-Identifier $appLogin
    Execute-Sql "USE [PTUD_LHU]; CREATE USER $loginIdentifier FOR LOGIN $loginIdentifier; ALTER ROLE [db_owner] ADD MEMBER $loginIdentifier;"

    $after = @(Read-Rows 'SELECT name, state_desc FROM sys.databases WHERE database_id > 4 ORDER BY name;')
    $unrelatedAfter = @($after | Where-Object { $_.name -cnotin $targetNames })
    if (($unrelatedBefore | ConvertTo-Json -Compress) -cne ($unrelatedAfter | ConvertTo-Json -Compress)) {
        throw 'Unrelated database inventory changed; inspect server state.'
    }
    $remainingTargets = @($after | Where-Object { $_.name -cin $targetNames })
    if ($remainingTargets.Count -ne 1 -or $remainingTargets[0].name -cne $newDatabase) {
        throw 'Unexpected PTUD database inventory after reset.'
    }
    $tables = @(Read-Rows 'SELECT COUNT(*) AS table_count FROM [PTUD_LHU].sys.tables WHERE is_ms_shipped=0;')
    if ($tables[0].table_count -ne 0) { throw 'Replacement database is not empty.' }

    $report = [ordered]@{
        completed_at_utc = [DateTime]::UtcNow.ToString('o')
        server = 'localhost'
        removed = @($targets | ForEach-Object name)
        replacement = $newDatabase
        replacement_user_tables = $tables[0].table_count
        seed_import_or_migration_applied = $false
        unrelated_databases_unchanged = $true
        before = $before
        after = $after
    }
    $reportDirectory = Join-Path $projectRoot 'output/database-reset'
    [void][System.IO.Directory]::CreateDirectory($reportDirectory)
    $reportPath = Join-Path $reportDirectory 'reset-result.json'
    [System.IO.File]::WriteAllText($reportPath, ($report | ConvertTo-Json -Depth 6), [System.Text.UTF8Encoding]::new($false))
    Write-Output ($report | ConvertTo-Json -Depth 6)
} finally { $connection.Dispose() }

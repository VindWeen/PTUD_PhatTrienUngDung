param([switch]$Apply, [switch]$TestRestore)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$archive=Join-Path $root 'backups/rich-demo-baseline'
$target=if($TestRestore){'PTUD_LHU_Demo_RichRestoreTest'}else{'PTUD_LHU_Demo'}
if(-not $Apply){
 Write-Output "Preview: restore only $target from backups/rich-demo-baseline. Stop the demo backend, then run npm run demo:reset -- -Apply. Changes in the demo DB will be replaced; PTUD_LHU is never targeted."
 exit 0
}
if($target -notin @('PTUD_LHU_Demo','PTUD_LHU_Demo_RichRestoreTest')){throw 'Invalid demo target'}
function SqlText([string]$s){return "N'"+$s.Replace("'","''")+"'"}
$manifestPath=Join-Path $archive 'backup_manifest.json'
$manifestHash=(Get-Content -LiteralPath (Join-Path $archive 'backup_manifest.sha256') -Raw).Trim()
if((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash -ne $manifestHash){throw 'Manifest hash mismatch'}
$manifest=Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if($manifest.database.name -ne 'PTUD_LHU_Demo' -or $manifest.database.archiveFile -ne 'database.bak' -or $manifest.storage.archiveDirectory -ne 'storage_backup'){throw 'Not a demo baseline archive'}
$bak=Join-Path $archive 'database.bak'
if((Get-FileHash -LiteralPath $bak -Algorithm SHA256).Hash -ne $manifest.database.sha256){throw 'BAK hash mismatch'}
$storageParent=[IO.Path]::GetFullPath((Join-Path $root 'backend/storage/demo'))
$restoredStorage=[IO.Path]::GetFullPath((Join-Path $storageParent ('reset_'+(Get-Date -Format 'yyyyMMdd_HHmmss')+'_'+[Guid]::NewGuid().ToString('N').Substring(0,6))))
if(-not $restoredStorage.StartsWith($storageParent+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Storage path escaped demo directory'}
# Copy to a NEW directory. Previous files remain available; no recursive deletion.
New-Item -ItemType Directory -Path $restoredStorage | Out-Null
foreach($file in $manifest.storage.files){
 $source=[IO.Path]::GetFullPath((Join-Path (Join-Path $archive 'storage_backup') $file.storageKey))
 $dest=[IO.Path]::GetFullPath((Join-Path $restoredStorage $file.storageKey))
 if(-not $source.StartsWith((Join-Path $archive 'storage_backup')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or -not $dest.StartsWith($restoredStorage+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid private-file path'}
 if((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $file.checksumSha256){throw 'Private-file hash mismatch'}
 New-Item -ItemType Directory -Force ([IO.Path]::GetDirectoryName($dest)) | Out-Null
 Copy-Item -LiteralPath $source -Destination $dest
}
$connection=New-Object System.Data.SqlClient.SqlConnection 'Server=localhost;Database=master;Integrated Security=True;TrustServerCertificate=True;Connect Timeout=10'
$connection.Open()
try{
 $q=$connection.CreateCommand();$q.CommandTimeout=180
 $q.CommandText="SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE database_id=DB_ID(N'$target') AND is_user_process=1"
 if([int]$q.ExecuteScalar() -gt 0){throw 'Demo database has active connections. Stop demo backend and close SSMS queries on this DB before resetting.'}
 $q.CommandText="SELECT DB_ID(N'$target')";$exists=$q.ExecuteScalar() -isnot [DBNull]
 if($TestRestore -and $exists){throw 'Restore-test DB already exists; refusing overwrite'}
 if(-not $TestRestore -and -not $exists){throw 'Demo DB missing; refusing an unexpected restore target'}
 $q.CommandText='RESTORE VERIFYONLY FROM DISK='+ (SqlText $bak)+' WITH CHECKSUM;';$q.ExecuteNonQuery() | Out-Null
 $q.CommandText="SELECT CONVERT(nvarchar(4000),SERVERPROPERTY('InstanceDefaultDataPath')),CONVERT(nvarchar(4000),SERVERPROPERTY('InstanceDefaultLogPath'))"
 $reader=$q.ExecuteReader();$reader.Read() | Out-Null;$dataDir=$reader.GetString(0);$logDir=$reader.GetString(1);$reader.Close()
 $q.CommandText='RESTORE FILELISTONLY FROM DISK='+(SqlText $bak)
 $table=New-Object System.Data.DataTable;$table.Load($q.ExecuteReader())
 $moves=@();$suffix=[Guid]::NewGuid().ToString('N').Substring(0,8)
 foreach($row in $table.Rows){
  if($row.Type -notin @('D','L')){throw 'Unsupported backup file type'}
  $dir=if($row.Type -eq 'L'){$logDir}else{$dataDir}
  $ext=if($row.Type -eq 'L'){'.ldf'}else{'.mdf'}
  $filename=if($exists){$target+'_runtime_'+$row.FileId+$ext}else{$target+'_'+$suffix+'_'+$row.FileId+$ext}
  # On an existing Demo DB reuse its exact physical files, never a source DB file.
  if($exists){
   $q.CommandText="SELECT physical_name FROM sys.master_files WHERE database_id=DB_ID(N'$target') AND file_id="+[int]$row.FileId
   $physical=[string]$q.ExecuteScalar()
   if(-not $physical){throw 'Missing demo database physical file'}
  }else{$physical=Join-Path $dir $filename}
  $moves+='MOVE '+(SqlText ([string]$row.LogicalName))+' TO '+(SqlText $physical)
 }
 # REPLACE is permitted only for the hardcoded demo DB, with an explicit -Apply.
 $replace=if($exists){',REPLACE'}else{''}
 $q.CommandText="RESTORE DATABASE [$target] FROM DISK="+(SqlText $bak)+' WITH CHECKSUM,RECOVERY,'+($moves -join ',')+$replace+';'
 $q.ExecuteNonQuery() | Out-Null
 $q.CommandText="DBCC CHECKDB ([$target]) WITH NO_INFOMSGS;";$q.ExecuteNonQuery() | Out-Null
 $q.CommandText="USE [$target]; SELECT COUNT(*) FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name='app'"
 $countEntries=@($manifest.database.tableCounts.PSObject.Properties)
 if([int]$q.ExecuteScalar() -ne $countEntries.Count){throw 'Restored table count differs'}
 foreach($entry in $countEntries){
  $name=[string]$entry.Name
  if($name -notmatch '^[a-z_]+$'){throw 'Unexpected table name in archive'}
  $q.CommandText="SELECT COUNT_BIG(*) FROM [$target].app.[$name]"
  $expected=$entry.Value
  if([long]$q.ExecuteScalar() -ne [long]$expected){throw "Restored rows differ: $name"}
 }
 if(-not $TestRestore){
  $envPath=Join-Path $root 'backend/.env.demo'
  $envContent=[IO.File]::ReadAllText($envPath)
  if($envContent -notmatch '(?m)^DB_NAME=PTUD_LHU_Demo\r?$'){throw 'Demo env does not name the demo DB'}
  $envContent=[regex]::Replace($envContent,'(?m)^STORAGE_DIR=.*$',('STORAGE_DIR='+$restoredStorage))
  [IO.File]::WriteAllText($envPath,$envContent,[Text.UTF8Encoding]::new($false))
 }
 $report=@{success=$true;target=$target;restoredAt=(Get-Date).ToString('o');privateFiles=$manifest.storage.totalFiles;storage=$restoredStorage;dbccCheckDb=$true;tableCountsMatch=$true;sourceDatabaseTouched=$false}
 $report | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $restoredStorage 'reset_report.json')
 Write-Output "Restored $target; CHECKDB passed; table counts matched; $($manifest.storage.totalFiles) files checked."
 if(-not $TestRestore){Write-Output 'Start backend with npm run demo. Sign out/in or use a fresh browser session.'}
}finally{$connection.Dispose()}

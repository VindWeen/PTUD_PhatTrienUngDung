$ErrorActionPreference = 'Stop'
$fixtureRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$fixtureSource = Join-Path $fixtureRoot 'Minh chứng nghiên cứu - bản 1.pdf'
$fixtureTarget = Join-Path $fixtureRoot 'Minh chứng quá dung lượng - 11 MiB.pdf'
if (Test-Path -LiteralPath $fixtureTarget) {
    throw 'Tệp quá dung lượng đã có. Dùng tệp hiện có hoặc tự xóa trước khi tạo lại.'
}
$fixtureBytes = [System.IO.File]::ReadAllBytes($fixtureSource)
$fixtureStream = [System.IO.File]::Open($fixtureTarget, [System.IO.FileMode]::CreateNew)
try {
    $fixtureStream.Write($fixtureBytes, 0, $fixtureBytes.Length)
    $fixtureStream.SetLength(11 * 1024 * 1024)
} finally {
    $fixtureStream.Dispose()
}
Write-Output "Đã tạo tệp kiểm tra giới hạn dung lượng: $fixtureTarget (11 MiB)."

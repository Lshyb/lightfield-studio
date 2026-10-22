param([string]$OutputPath)
$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $OutputPath) { $OutputPath = Join-Path $taskRoot 'Lightfield.exe' }
$taskOutput = [System.IO.Path]::GetFullPath($OutputPath)
$taskCompiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $taskCompiler)) {
    throw 'The Windows x64 .NET Framework C# compiler was not found.'
}
$taskSource = Join-Path $taskRoot 'windows\LightfieldLauncher.cs'
$taskArguments = @(
    '/nologo', '/target:winexe', '/platform:x64', '/langversion:5',
    '/optimize+', '/debug-', '/utf8output',
    ('/out:' + $taskOutput),
    '/reference:System.dll', '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll',
    $taskSource
)
& $taskCompiler @taskArguments
if ($LASTEXITCODE -ne 0) { throw ('C# compilation failed: ' + $LASTEXITCODE) }
$taskHash = Get-FileHash -LiteralPath $taskOutput -Algorithm SHA256
Write-Output ('Built: ' + $taskOutput)
Write-Output ('SHA256: ' + $taskHash.Hash.ToLowerInvariant())

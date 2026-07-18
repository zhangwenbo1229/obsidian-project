# Concatenate CSS modules into styles.css at the project root
# Module order: base.css, project-view.css, task-editor.css, settings.css, dashboard.css

param(
    [string]$OutputFile = "styles.css"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
$StylesDir = Join-Path $ProjectRoot "src\styles"
$OutputPath = Join-Path $ProjectRoot $OutputFile

$modules = @(
    "base.css",
    "project-view.css",
    "task-editor.css",
    "settings.css",
    "dashboard.css"
)

$tempFile = [System.IO.Path]::GetTempFileName()

try {
    foreach ($module in $modules) {
        $modulePath = Join-Path $StylesDir $module
        if (-not (Test-Path $modulePath)) {
            Write-Error "Module not found: $modulePath"
            exit 1
        }
        $content = Get-Content $modulePath -Encoding UTF8 -Raw
        Add-Content -Path $tempFile -Value $content -Encoding UTF8 -NoNewline
        Add-Content -Path $tempFile -Value "`r`n" -Encoding UTF8 -NoNewline
    }

    # Remove trailing extra newline
    $final = (Get-Content $tempFile -Encoding UTF8 -Raw).TrimEnd("`r`n")
    Set-Content -Path $OutputPath -Value $final -Encoding UTF8 -NoNewline

    Write-Host "Concatenated $($modules.Count) modules -> $OutputPath"
} finally {
    if (Test-Path $tempFile) {
        Remove-Item $tempFile -Force
    }
}
# Installs the wayne-progress pane and binds ctrl-shift-m to open or close it. Re-run to update.
$ErrorActionPreference = 'Stop'
$app = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME } else { "$env:USERPROFILE\.config\herdr-app" }
$herdr = "$env:LOCALAPPDATA\Programs\herdr-app\herdr-app.exe"

$dir = "$app\mods\wayne-progress"
# A new mod folder whose main.js Herdr sees before mod.json gets the default place: build it outside mods\ and move it in whole.
$to = if (Test-Path $dir) { $dir } else { New-Item -ItemType Directory -Force "$app\.staging-wayne-progress" }
Copy-Item "$PSScriptRoot\mods\wayne-progress\*.js", "$PSScriptRoot\mods\wayne-progress\mod.json" $to -Force
if ("$to" -ne $dir) { Move-Item $to $dir }

# A right column with a fixed id, so ctrl-shift-m can toggle it (mod.open would float it as an overlay instead).
$layout = "$app\layouts\main-wintoast.json"
if (-not (Test-Path $layout)) { throw "$layout not found: run herdr-notify-win's install.ps1 first" }
function Get-Nodes($node) { $node; foreach ($c in @($node.children)) { if ($null -ne $c) { Get-Nodes $c } } }
# [IO.File] reads and writes UTF-8 (no BOM) in both pwsh and Windows PowerShell 5.1.
$root = [IO.File]::ReadAllText($layout) | ConvertFrom-Json
$block = Get-Nodes $root | Where-Object { $_.content.mod -eq 'wayne-progress' } | Select-Object -First 1
if ($block) { $block.id = 'wayne-progress' }
else { $root.children += [pscustomobject]@{ id = 'wayne-progress'; type = 'block'; content = @{ mod = 'wayne-progress' }; size = @{ px = 380 } } }
[IO.File]::WriteAllText($layout, ($root | ConvertTo-Json -Depth 100))

$keys = "$app\keys.json"
$k = [IO.File]::ReadAllText($keys) | ConvertFrom-Json
$bind = 'layout.toggle:wayne-progress'
if ($k.global.'ctrl-shift-m' -ne $bind) {
    $k.global | Add-Member 'ctrl-shift-m' $bind -Force
    [IO.File]::WriteAllText($keys, ($k | ConvertTo-Json -Depth 100))
}

& $herdr check $dir
if ($LASTEXITCODE) { throw 'herdr-app check wayne-progress failed' }

$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$manifest=Join-Path $projectRoot '.runtime\app-processes.json'
$ports=@{frontend=5400;gateway=8080;backend=8081}
if(Test-Path $manifest){foreach($saved in (Get-Content $manifest -Raw|ConvertFrom-Json)){if($saved.name -and $saved.port){$ports[$saved.name]=[int]$saved.port}}}
foreach($item in @(@{name='frontend';port=$ports.frontend},@{name='gateway';port=$ports.gateway},@{name='backend';port=$ports.backend})){
 $tcp=Get-NetTCPConnection -LocalPort $item.port -State Listen -ErrorAction SilentlyContinue
 [pscustomobject]@{service=$item.name;port=$item.port;listening=[bool]$tcp;processId=($tcp.OwningProcess -join ',')}
}


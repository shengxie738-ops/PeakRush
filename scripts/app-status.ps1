$ErrorActionPreference='Stop'
foreach($item in @(@{name='frontend';port=5400},@{name='gateway';port=8080},@{name='backend';port=8081})){
 $tcp=Get-NetTCPConnection -LocalPort $item.port -State Listen -ErrorAction SilentlyContinue
 [pscustomobject]@{service=$item.name;port=$item.port;listening=[bool]$tcp;processId=($tcp.OwningProcess -join ',')}
}


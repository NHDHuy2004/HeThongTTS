$ErrorActionPreference = 'Stop'
$c = Get-Content -LiteralPath '.env.local'
foreach ($line in $c) {
  if ($line -match '^\s*#') { continue }
  if ($line -notmatch '=') { continue }
  $kv = $line -split '=', 2
  $k = $kv[0].Trim()
  $v = $kv[1].Trim().Trim('"', "'")
  if ($v -eq '') { continue }
  switch ($k) {
    'NEXT_PUBLIC_SUPABASE_URL' {
      try { $h = ([uri]$v).Host } catch { $h = 'INVALID-URL' }
      $ph = ($v -match '\{\{|YOUR|placeholder') -or ($h -eq 'supabase.com')
      Write-Output ("URL host={0} placeholder={1}" -f $h, $ph)
    }
    'NEXT_PUBLIC_SUPABASE_ANON_KEY' {
      $parts = $v.Split('.')
      $isJwt = (($parts.Count -eq 3) -and ($parts[0].Length -gt 10))
      Write-Output ("ANON jwt={0} len={1}" -f $isJwt, $v.Length)
    }
    'SUPABASE_SERVICE_ROLE_KEY' {
      $parts = $v.Split('.')
      $isJwt = (($parts.Count -eq 3) -and ($parts[0].Length -gt 10))
      Write-Output ("SERVICE jwt={0} len={1}" -f $isJwt, $v.Length)
    }
    'RESEND_API_KEY' {
      Write-Output ("RESEND placeholder={0} len={1}" -f ($v -match 're_xx|RESEND'), $v.Length)
    }
    default {
      Write-Output ("$k present=<yes>")
    }
  }
}

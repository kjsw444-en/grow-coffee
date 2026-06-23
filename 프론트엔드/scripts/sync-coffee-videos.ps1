param(

  [string]$SourceFile,

  [string]$DestName

)



$ErrorActionPreference = 'Stop'



$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

$destDirs = @(

  (Join-Path $root '백엔드\public\videos'),

  (Join-Path $root '프론트엔드\public\videos')

)

$base = 'C:\Users\USER\OneDrive\Desktop\미니앱_커피 키우기\이미지, 영상'

$femaleDir = Join-Path $base '커피 마시는 여자 영상'

$maleDir = Join-Path $base '커피 마시는 남자 영상'

$hiddenDir = Join-Path $base '히든 영상'



foreach ($destDir in $destDirs) {

  New-Item -ItemType Directory -Force -Path $destDir | Out-Null

}



function Copy-ByPattern {

  param(

    [string]$SourceDir,

    [string]$Pattern,

    [string]$Dest

  )

  $file = Get-ChildItem -LiteralPath $SourceDir -Filter $Pattern -File | Select-Object -First 1

  if (-not $file) {

    Write-Warning "MISSING pattern '$Pattern' in $SourceDir"

    return $false

  }

  foreach ($destDir in $destDirs) {

    $destPath = Join-Path $destDir $Dest

    Copy-Item -LiteralPath $file.FullName -Destination $destPath -Force

  }

  $size = (Get-Item -LiteralPath (Join-Path $destDirs[0] $Dest)).Length

  Write-Output ("OK {0} <= {1} ({2:N2} MB)" -f $Dest, $file.Name, ($size / 1MB))

  return $true

}



function Copy-SingleFile {

  param(

    [string]$Source,

    [string]$Dest

  )

  if (-not (Test-Path -LiteralPath $Source)) {

    throw "Source not found: $Source"

  }

  foreach ($destDir in $destDirs) {

    $destPath = Join-Path $destDir $Dest

    Copy-Item -LiteralPath $Source -Destination $destPath -Force

  }

  $size = (Get-Item -LiteralPath (Join-Path $destDirs[0] $Dest)).Length

  Write-Output ("OK {0} <= {1} ({2:N2} MB)" -f $Dest, (Split-Path -Leaf $Source), ($size / 1MB))

}



# 단일 파일 교체: -SourceFile "경로" -DestName "coffee-drink-....mp4"

if ($SourceFile -and $DestName) {

  Copy-SingleFile -Source $SourceFile -Dest $DestName

  Write-Output ''

  Write-Output '다음: 백엔드/mediaAssets.js + 프론트엔드/src/services/mediaAssets.ts 버전 +1, git add 백엔드/public/videos'

  exit 0

}



Write-Output '=== 여성 커피 마시기 ==='

Copy-ByPattern $femaleDir '*알바*카페*' 'coffee-drink-parttime-latte.mp4' | Out-Null

Copy-ByPattern $femaleDir '*학생*콜드*' 'coffee-drink-student-coldbrew.mp4' | Out-Null

Copy-ByPattern $femaleDir '*헤이즐*' 'coffee-drink-blonde-hazelnut.mp4' | Out-Null

Copy-ByPattern $femaleDir '*돌체*' 'coffee-drink-dolce-latte.mp4' | Out-Null

Copy-ByPattern $femaleDir '*아메리*' 'coffee-drink-sexy-americano.mp4' | Out-Null

Copy-ByPattern $femaleDir '*바닐*' 'coffee-drink-chic-vanilla-latte.mp4' | Out-Null



Write-Output '=== 남성 커피 마시기 ==='

Copy-ByPattern $maleDir '*카페*' 'coffee-drink-m-parttime-latte.mp4' | Out-Null

Copy-ByPattern $maleDir '*콜드*' 'coffee-drink-m-student-coldbrew.mp4' | Out-Null

Copy-ByPattern $maleDir '*헤이즐*' 'coffee-drink-m-blonde-hazelnut.mp4' | Out-Null

Copy-ByPattern $maleDir '*돌체*' 'coffee-drink-m-dolce-latte.mp4' | Out-Null

Copy-ByPattern $maleDir '*아메리*' 'coffee-drink-m-sexy-americano.mp4' | Out-Null

Copy-ByPattern $maleDir '*바닐*' 'coffee-drink-m-chic-vanilla-latte.mp4' | Out-Null



Write-Output '=== 히든 커플 ==='

Copy-ByPattern $hiddenDir '*헤이즐*카페*' 'coffee-drink-hidden-hazelnut-m-cafe-latte-f.mp4' | Out-Null

Copy-ByPattern $hiddenDir '*카페*헤이즐*' 'coffee-drink-hidden-cafe-latte-m-hazelnut-f.mp4' | Out-Null

Copy-ByPattern $hiddenDir '*돌체*아메리*' 'coffee-drink-hidden-dolce-m-americano-f.mp4' | Out-Null

Copy-ByPattern $hiddenDir '*돌체*커플*' 'coffee-drink-hidden-dolce-m-dolce-f.mp4' | Out-Null

Copy-ByPattern $hiddenDir '*바닐*돌체*' 'coffee-drink-hidden-vanilla-m-dolce-f.mp4' | Out-Null

Copy-ByPattern $hiddenDir '*아메리*바닐*' 'coffee-drink-hidden-americano-m-vanilla-f.mp4' | Out-Null



Write-Output '=== 완료 (백엔드/public/videos 기준) ==='

Get-ChildItem -LiteralPath $destDirs[0] -Filter '*.mp4' | Sort-Object Name | ForEach-Object {

  '{0,-48} {1,7:N2} MB' -f $_.Name, ($_.Length / 1MB)

}



Write-Output ''

Write-Output '다음: git add 백엔드/public/videos && mediaAssets.js 버전 +1 (필요 시)'


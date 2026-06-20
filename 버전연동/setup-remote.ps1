# GROW-OFFEE 원격 Git 연동 스크립트
# 사용: .\버전연동\setup-remote.ps1 -RepoUrl "https://github.com/kjsw444-en/grow-coffee.git"

param(
    [Parameter(Mandatory = $true)]
    [string]$RepoUrl
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

Set-Location $root

Write-Host "프로젝트 루트: $root"

if (-not (git rev-parse --verify HEAD 2>$null)) {
    Write-Error "로컬 커밋이 없습니다. 먼저 git add / git commit 을 실행하세요."
}

$branch = git branch --show-current
if ($branch -ne "main") {
    git branch -M main
    Write-Host "브랜치 이름을 main 으로 변경했습니다."
}

$existing = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0) {
    if ($existing -eq $RepoUrl) {
        Write-Host "origin 이 이미 등록되어 있습니다: $RepoUrl"
    } else {
        git remote set-url origin $RepoUrl
        Write-Host "origin URL 을 변경했습니다: $RepoUrl"
    }
} else {
    git remote add origin $RepoUrl
    Write-Host "origin 을 등록했습니다: $RepoUrl"
}

git push -u origin main
Write-Host "완료: 원격 main 브랜치에 push 했습니다."

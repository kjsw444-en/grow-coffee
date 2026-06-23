# 3. 버전연동 (Git)

코드 변경 이력을 원격 저장소에 안전하게 보관합니다.

## 하는 일

- Git 초기화·원격 연결
- 커밋·푸시로 작업 기록
- Railway 자동 배포 트리거 (연결 시)

## 현재 상태

| 항목 | 상태 |
|------|------|
| 로컬 Git | `GROW-OFFEE` 루트 |
| 기본 브랜치 | `main` |
| 원격 저장소 | `https://github.com/kjsw444-en/grow-coffee.git` |
| 금고양이 참고 | `https://github.com/kjsw444-en/goldcat.git` |

## 체크리스트

- [x] 로컬 Git 초기화
- [x] `.gitignore` (node_modules, .env, dist 등)
- [x] 첫 커밋
- [x] GitHub 저장소 생성
- [x] `origin` 원격 등록
- [x] 첫 push

## 현재 동기화 상태

- `main` ↔ `origin/main` 동기화 완료
- Railway `grow-coffee` 서비스가 GitHub `kjsw444-en/grow-coffee` 저장소와 연결됨
- 민감 정보는 `.gitignore` 대상이며 Railway Variables에 등록

## 1. GitHub 로그인 (최초 1회)

```powershell
gh auth login
```

브라우저 또는 토큰으로 로그인합니다.

## 2. GitHub 저장소 만들기

### 방법 A — GitHub CLI (권장)

```powershell
cd C:\Users\USER\Projects\GROW-OFFEE
gh repo create grow-coffee --private --source=. --remote=origin --push
```

### 방법 B — 웹에서 생성 후 연결

1. [GitHub New repository](https://github.com/new) 에서 `grow-coffee` 생성 (README 추가 안 함)
2. 아래 스크립트 실행:

```powershell
cd C:\Users\USER\Projects\GROW-OFFEE
.\버전연동\setup-remote.ps1 -RepoUrl "https://github.com/kjsw444-en/grow-coffee.git"
```

## 3. 이후 작업 흐름

```powershell
cd C:\Users\USER\Projects\GROW-OFFEE
git status
git add .
git commit -m "feat: 물주기 UI 개선"
git push
```

## 커밋 규칙 (권장)

| 접두사 | 용도 |
|--------|------|
| `feat:` | 새 기능 |
| `fix:` | 버그 수정 |
| `chore:` | 설정·구조 변경 |
| `docs:` | README 등 문서 |

## 주의

- `.env`, API 키, 토스 mTLS 인증서는 **절대 커밋하지 않기**
- `node_modules`, `dist`, `.granite/` 는 `.gitignore` 로 제외됨
- 프론트·백엔드는 **하나의 저장소**에서 관리 (4단계 폴더 구조)

## 브랜치 권장

- `main` — 출시 가능한 안정 버전
- `develop` — 개발 중 (선택)

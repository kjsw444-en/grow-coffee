# GROW-OFFEE (커피 키우기)

토스 미니앱 — 원두 키우기 → 커피 판매 → 4,700원 목표

## 4단계 구조

| 폴더 | 역할 | 비유 |
|------|------|------|
| `프론트엔드/` | 화면, UX, 임시 데이터, 표시용 계산 | 홀·메뉴판 |
| `Toss 미니앱 개발 및 연동/` | 토스 SDK, 로그인, 배포·검수 | 토스 매장 입점 |
| `버전연동/` | Git 원격 저장소, 변경 이력 | 설계도 보관소 |
| `백엔드/` | API, DB, 조작 방지, 중요 계산 | 주방·금고 |

## 작업 순서

1. **프론트엔드** — 화면·흐름·릴리즈 빌드 ✅
2. **백엔드** — 저장·검증 API ✅
3. **API 연동** — 프론트 ↔ 백엔드 ✅
4. **버전연동** — GitHub 원격 등록·동기화 ✅
5. **Railway** — 백엔드·DB 운영 배포 ✅
6. **Toss 연동** — 샌드박스 실기기 로그인 테스트 필요

## 현재 운영 상태

- GitHub: `https://github.com/kjsw444-en/grow-coffee.git`
- Railway API: `https://grow-coffee-production.up.railway.app`
- Health check: `https://grow-coffee-production.up.railway.app/api/health`
- 운영 저장소: Supabase (`storageReady: true`)
- 프론트 검증: `npm run build:vite` 통과, `npm run lint` 오류·경고 0개

## 빠른 실행 (프론트)

```bash
cd 프론트엔드
npm run dev:vite
```

## 빠른 실행 (백엔드)

```bash
cd 백엔드
npm install
npm run dev
```

헬스체크: http://localhost:8787/api/health

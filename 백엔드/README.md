# 4. 백엔드 (grow-coffee-api)

goldcat(`금고양이-키우기/server`) 패턴을 참고하되, **별도 Supabase·Railway·DB 파일**을 사용합니다.

## goldcat vs GROW-OFFEE

| 항목 | goldcat | GROW-OFFEE |
|------|---------|------------|
| 서비스명 | `goldcat-api` | `grow-coffee-api` |
| 유저 헤더 | `x-goldcat-user` | `x-grow-coffee-user` |
| 로컬 DB 파일 | `goldcat-db.json` | `grow-coffee-db.json` |
| 게임 저장 | JSON `game_saves` | `game_states` 컬럼 |
| 랭킹 기준 | 체중(kg) | 상점 사용 커피잔 (`spentCoffeeCups`) |
| Supabase | goldcat 전용 프로젝트 | **새 프로젝트** (공유 금지) |

## API

### 인증
- `POST /api/auth/guest` — deviceId 게스트 (Supabase 또는 로컬 파일)
- `POST /api/auth/toss` — 토스 로그인 (mTLS + 복호화 키)
- `GET|POST /api/auth/toss/unlink` — 연결 끊기 콜백

### 게임
- `GET /api/game/state` — 상태 + `playerRank`
- `POST /api/game/water` / `drink` / `watch-ad` / `reset`
- `POST /api/game/purchase-variant` / `select-variant`

### 랭킹 (goldcat `/api/ranking/*` 패턴)
- `GET /api/ranking/top50`
- `POST /api/ranking/submit` — `spentCoffeeCups` 제출

### DEV (로컬만)
- `POST /api/game/dev/bump`
- `POST /api/game/dev/set-coffees`

## 저장소

| 환경 | 방식 |
|------|------|
| 로컬 개발 | `data/grow-coffee-db.json` (gitignore) |
| Railway 운영 | Supabase 필수 (`NODE_ENV=production`) |

## 체크리스트

- [x] Express + 게임 로직 (서버 계산)
- [x] goldcat식 미들웨어 (`requireUser`, `requireStorage`)
- [x] 로컬 파일 저장 (goldcat `store.js` 패턴)
- [x] 토스 로그인 골격 (mTLS, decrypt, unlink)
- [x] 게스트→토스 진행 데이터 병합
- [x] 랭킹 API
- [x] Supabase 프로젝트 생성 + `schema.sql`
- [x] Railway 배포 — `https://grow-coffee-production.up.railway.app`

## 로컬 실행

```bash
cd 백엔드
npm install
npm run dev
```

헬스체크: http://localhost:8787/api/health

## 테스트

```bash
npm run test
```

방치 커피·물주기 쿼터·공유 리워드 로직을 `scripts/test-*.mjs`로 검증합니다.

> **참고:** 예전에 `backend/`와 `백엔드/`가 Git에 중복 등록되어 있었습니다. 현재는 **`백엔드/`만** 유지합니다.

## Supabase

1. **새** Supabase 프로젝트 (goldcat DB 재사용 ❌)
2. SQL Editor → `schema.sql`
3. `.env`에 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`

## Railway

운영 서비스는 Railway `grow-coffee` 서비스로 분리되어 있습니다.

- URL: `https://grow-coffee-production.up.railway.app`
- Health: `GET /api/health`
- 현재 운영 저장소: Supabase

세부 설정은 `railway-deploy.md` 참고.

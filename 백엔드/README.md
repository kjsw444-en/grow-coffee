# 4. 백엔드

데이터 저장·중요 계산·조작 방지. Railway 배포 대상.

## 하는 일

- `POST /api/auth/guest` — 게스트 세션 (deviceId)
- `GET /api/game/state` — 유저 상태 조회
- `POST /api/game/tap` — 성장·수확 (서버만 판매가·목표금 계산)
- `POST /api/game/redeem` — 4,700원 달성 검증
- `POST /api/game/reset` — 게임 초기화

## 하지 않는 일

- 화면 디자인
- 클라이언트가 보낸 금액 그대로 신뢰

## 체크리스트

- [x] Express API 골격
- [x] 게임 로직 (서버 계산, 탭 쿨다운)
- [x] 로컬 메모리 저장 (Supabase 없이 테스트)
- [ ] Supabase 연결 + `schema.sql` 실행
- [ ] Railway 배포 + 프론트 `VITE_API_URL` 연동

## 로컬 실행

```bash
cd 백엔드
npm install
npm run dev
```

헬스체크: http://localhost:8787/api/health

## API 예시

```bash
# 게스트 로그인
curl -X POST http://localhost:8787/api/auth/guest \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\":\"test-device-1\"}"

# 탭 (userId는 auth 응답값)
curl -X POST http://localhost:8787/api/game/tap \
  -H "Content-Type: application/json" \
  -H "x-grow-coffee-user: <userId>"

# 상태 조회
curl http://localhost:8787/api/game/state?userId=<userId>
```

## Supabase 설정

1. Supabase 프로젝트 생성
2. SQL Editor에서 `schema.sql` 실행
3. `.env`에 `SUPABASE_URL`, `SUPABASE_SECRET_KEY` 입력

Supabase 미설정 시 **메모리 저장소**로 동작합니다 (서버 재시작 시 초기화).

## 게임 규칙 (서버 고정)

| 항목 | 값 |
|------|-----|
| 목표 금액 | 4,700원 |
| 커피 1잔 | 47원 |
| 탭 1회 성장 | +10% |
| 탭 쿨다운 | 200ms |

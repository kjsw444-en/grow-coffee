# 1. 프론트엔드

사용자가 보고 조작하는 화면.

## 폴더 구조

```
src/
├── api/             # 백엔드 API 호출
├── layout/          # 앱 전체 껍데기
├── pages/           # 화면 단위
├── components/      # UI 조각
│   └── ui/          # 공통 버튼·카드
└── game/            # 게임 훅·상수·타입
```

## 현재 상태

- [x] 커피 키우기 UI (홀드 물주기 / 커피마시기)
- [x] 백엔드 API 연동 (`/api/auth/guest`, `/api/game/water`, `/api/game/drink`)
- [x] 온보딩·설정·사운드
- [ ] 토스 샌드박스 UI 확인

## 실행

백엔드와 함께 실행:

```bash
# 터미널 1
cd ../백엔드
npm run dev

# 터미널 2
npm install
npm run dev:vite
```

로컬에서는 Vite proxy가 `/api` → `localhost:8787` 로 연결합니다.

## 환경변수

`.env.example` 참고. Railway 배포 후:

```
VITE_API_URL=https://your-api.up.railway.app
```

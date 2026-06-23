# 토스 로그인 (grow-coffee)

토스 로그인만 **별도로** 정리·테스트하는 작업 공간입니다.  
백엔드·프론트 코드는 각각 `백엔드/`, `프론트엔드/`에 이미 있고, 여기서는 **설정·인증서·체크리스트·메모**를 관리합니다.

> goldcat(금고양이)과 **설정·인증서·Supabase·Railway를 섞지 마세요.**

---

## 백엔드 — 완료된 것

| 항목 | 상태 |
|------|------|
| `POST /api/auth/guest` | ✅ |
| `POST /api/auth/toss` | ✅ (mTLS·복호화 키 필요) |
| Supabase 프로필·게임 state | ✅ |
| Railway 배포 | ✅ `grow-coffee-production.up.railway.app` |

헬스체크: `GET /api/health` → `supabase: true`  
토스 준비 전: `tossMtls: false`, `tossDecrypt: false` (정상)

---

## 이 폴더에서 할 일 (순서)

### 1. 앱인토스 콘솔

1. [앱인토스 콘솔](https://apps-in-toss.toss.im/) → 앱 **grow-coffee**
2. **토스 로그인** 기능 추가
3. mTLS 인증서 발급
4. 복호화 키 이메일 신청

### 2. 인증서 보관 (git에 올리지 않음)

```
백엔드/cert/public.crt
백엔드/cert/private.key
```

### 3. 환경 변수

**로컬** — `백엔드/.env`:

```env
TOSS_CLIENT_CERT_PATH=cert/public.crt
TOSS_CLIENT_KEY_PATH=cert/private.key
DECRYPTION_KEY_BASE64=...
AAD_STRING=...
```

**Railway** — grow-coffee 서비스 Variables:

| 변수 | 설명 |
|------|------|
| `TOSS_CLIENT_CERT` | PEM 전체 (멀티라인) |
| `TOSS_CLIENT_KEY` | PEM 전체 |
| `DECRYPTION_KEY_BASE64` | 콘솔 발급 |
| `AAD_STRING` | 콘솔 발급 |

### 4. 로컬 확인

```powershell
cd 백엔드
npm.cmd run dev
```

`http://localhost:8787/api/health` → `tossMtls: true`, `tossDecrypt: true`

### 5. 샌드박스 테스트

```powershell
cd 프론트엔드
npm.cmd run dev
```

토스 샌드박스 앱에서 `grow-coffee` 실행 → 설정 → 토스 로그인

---

## 코드 위치 (수정은 여기서)

| 구분 | 파일 |
|------|------|
| 프론트 로그인 | `프론트엔드/src/services/tossBridge.ts` |
| API 호출 | `프론트엔드/src/services/api.ts` |
| 게임 연동 | `프론트엔드/src/game/useCoffeeGame.ts` |
| 설정 UI | `프론트엔드/src/components/SettingsSheet.tsx` |
| 백엔드 토스 | `백엔드/tossAuth.js`, `tossTlsClient.js`, `tossDecrypt.js` |
| 인증 라우트 | `백엔드/index.js` → `/api/auth/toss` |

---

## 상세 가이드

→ [`../Toss 미니앱 개발 및 연동/토스-로그인-가이드.md`](../Toss%20미니앱%20개발%20및%20연동/토스-로그인-가이드.md)

---

## 체크리스트

- [ ] 앱인토스 콘솔 — 토스 로그인 ON
- [ ] mTLS cert → `백엔드/cert/`
- [ ] 복호화 키 → `.env` + Railway Variables
- [ ] health — `tossMtls: true`, `tossDecrypt: true`
- [ ] 샌드박스 — 토스 로그인 성공
- [ ] Railway — Variables 반영 후 재배포

---

## 작업 메모

(테스트 결과, 콘솔 설정 값 메모 등 — 여기에 적어도 됩니다)

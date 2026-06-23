# Railway 배포 (grow-coffee-api)

goldcat과 **별도 Railway 서비스**로 배포합니다. goldcat API URL/DB와 섞지 마세요.

## 1. Railway 프로젝트

1. [Railway](https://railway.app) → New Project → GitHub `grow-coffee` 연결
2. Root Directory: `백엔드`
3. Start Command: `npm start`

## 2. Variables (필수)

| 변수 | 설명 |
|------|------|
| `SUPABASE_URL` | GROW-OFFEE 전용 Supabase 프로젝트 URL |
| `SUPABASE_SECRET_KEY` | service_role / secret key |
| `NODE_ENV` | `production` |

## 3. Variables (토스 로그인)

| 변수 | 설명 |
|------|------|
| `TOSS_CLIENT_CERT` | PEM 전체 (멀티라인 붙여넣기) |
| `TOSS_CLIENT_KEY` | PEM 전체 |
| `DECRYPTION_KEY_BASE64` | 콘솔 발급 복호화 키 |
| `AAD_STRING` | AAD 문자열 |
| `TOSS_UNLINK_CALLBACK_AUTH` | `clientId:clientSecret` (연결 끊기 콜백) |

로컬은 `TOSS_CLIENT_CERT_PATH` / `TOSS_CLIENT_KEY_PATH` 사용 가능.

## 4. Supabase

1. **새 Supabase 프로젝트** 생성 (goldcat DB 재사용 금지)
2. SQL Editor → `schema.sql` 실행
3. Railway Variables에 URL/키 등록

## 5. 프론트 연동

Railway 도메인 발급 후:

```
VITE_API_URL=https://grow-coffee-api.up.railway.app
```

토스 미니앱 빌드 시 이 값으로 API 호출.

## 6. 헬스체크

```
GET https://<your-domain>/api/health
```

응답 예:

```json
{
  "ok": true,
  "service": "grow-coffee-api",
  "storage": "supabase",
  "supabase": true,
  "tossMtls": true,
  "tossDecrypt": true
}
```

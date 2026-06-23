# 2. Toss 미니앱 개발 및 연동

토스 앱 안에서 미니앱이 돌아가도록 연동·배포.

## 하는 일

- 앱인토스 콘솔 앱 등록 (`appName: grow-coffee`)
- `granite.config.ts` 브랜드·아이콘 설정
- 토스 로그인 / 공유 / 광고 SDK (필요 시)
- `ait build` → 콘솔 업로드 → 샌드박스·검수·출시

## 참고

- 프론트 설정: `../프론트엔드/granite.config.ts`
- SDK: `@apps-in-toss/web-framework` 2.x
- iframe 사용 불가 (검수 반려)

## 체크리스트

- [ ] 앱인토스 콘솔 등록
- [ ] 샌드박스 앱 QR 테스트
- [ ] 토스 로그인 콘솔 등록 + mTLS cert
- [ ] 복호화 키 `.env` 설정
- [ ] 샌드박스에서 설정 → 토스 로그인 테스트
- [ ] `ait build` / `ait deploy`
- [ ] 심사·출시

상세: [토스-로그인-가이드.md](./토스-로그인-가이드.md)

## 링크

- 콘솔: https://apps-in-toss.toss.im/
- 개발자센터: https://developers-apps-in-toss.toss.im/

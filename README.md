# 숫자 채팅

닉네임과 메시지에 ASCII 숫자 `0~9`만 입력할 수 있는 실시간 채팅입니다.

## 기능

- 닉네임: 숫자 1~12자리
- 메시지: 숫자 1~200자리
- Socket.IO 실시간 통신
- 최근 메시지 200개 JSON 저장
- 1초에 1개, 10초에 최대 5개 전송 제한
- 온라인 접속자 수
- 모바일 대응
- 파일·이미지 업로드 없음
- 서버와 브라우저 양쪽에서 숫자 검증

화면상 계정 없이 이용하는 익명 채팅이지만, 호스팅 업체·Cloudflare·Nginx 등 인프라에는 접속 메타데이터가 남을 수 있습니다.

## 로컬 실행

Node.js 20 이상이 필요합니다.

```bash
npm install
npm run check
npm run dev
```

브라우저에서 `http://127.0.0.1:3230`을 엽니다.

## 환경변수

`.env.example` 참고:

- `PORT`: 서버 포트, 기본값 `3230`
- `CHAT_HISTORY_LIMIT`: 보존할 최근 메시지 수, 기본값 `200`
- `MAX_CONNECTIONS`: 최대 동시 연결 수, 기본값 `300`
- `DATA_DIR`: 메시지 JSON 저장 폴더, 기본값 `./data`

## VM 배포

```bash
git clone https://github.com/yddfhbh/pyhok11.git ~/pyhok11
cd ~/pyhok11
npm install --omit=dev
pm2 start ecosystem.config.cjs
pm2 save
curl http://127.0.0.1:3230/health
```

기존 배포 갱신:

```bash
cd ~/pyhok11
git pull --ff-only
npm install --omit=dev
pm2 restart pyhok-numeric-chat
curl http://127.0.0.1:3230/health
```

## Nginx

`nginx-pyhok-chat.conf.example`을 참고합니다. Socket.IO용 WebSocket 헤더가 포함되어 있습니다.

Cloudflare를 사용한다면 DNS 레코드를 프록시 상태로 두고, 운영 시 SSL/TLS는 `Full (strict)`와 유효한 원본 인증서를 사용하는 구성이 적절합니다.

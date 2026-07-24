'use strict';

const socket = io({ transports: ['websocket', 'polling'] });

const form = document.querySelector('#chatForm');
const nicknameInput = document.querySelector('#nicknameInput');
const messageInput = document.querySelector('#messageInput');
const messageList = document.querySelector('#messageList');
const onlineCount = document.querySelector('#onlineCount');
const statusMessage = document.querySelector('#statusMessage');
const sendButton = document.querySelector('#sendButton');

const savedNickname = localStorage.getItem('numeric-chat:nickname');
if (savedNickname && /^[0-9]{1,12}$/.test(savedNickname)) {
  nicknameInput.value = savedNickname;
}

nicknameInput.addEventListener('input', () => {
  nicknameInput.value = keepDigits(nicknameInput.value, 12);
});

messageInput.addEventListener('input', () => {
  messageInput.value = keepDigits(messageInput.value, 200);
});

form.addEventListener('submit', event => {
  event.preventDefault();
  clearStatus();

  const nickname = nicknameInput.value;
  const text = messageInput.value;

  if (!/^[0-9]{1,12}$/.test(nickname)) {
    showStatus('닉네임은 숫자 1~12자리만 가능합니다.', true);
    nicknameInput.focus();
    return;
  }

  if (!/^[0-9]{1,200}$/.test(text)) {
    showStatus('메시지는 숫자 1~200자리만 가능합니다.', true);
    messageInput.focus();
    return;
  }

  setSending(true);

  socket.emit('chat:send', { nickname, text }, response => {
    setSending(false);

    if (!response?.ok) {
      showStatus(response?.error || '메시지를 보내지 못했습니다.', true);
      return;
    }

    localStorage.setItem('numeric-chat:nickname', nickname);
    messageInput.value = '';
    messageInput.focus();
  });
});

socket.on('connect', () => {
  showStatus('채팅 서버에 연결되었습니다.', false);
  setTimeout(clearStatus, 1500);
});

socket.on('disconnect', () => {
  showStatus('서버와 연결이 끊겼습니다. 다시 연결하는 중입니다.', true);
});

socket.on('connect_error', error => {
  showStatus(error?.message || '채팅 서버에 연결하지 못했습니다.', true);
});

socket.on('chat:history', messages => {
  if (!Array.isArray(messages)) return;
  for (const message of messages) appendMessage(message, false);
  scrollToBottom();
});

socket.on('chat:message', message => {
  appendMessage(message, true);
});

socket.on('chat:online', payload => {
  const count = Number(payload?.count || 0);
  onlineCount.textContent = `${count}명 접속`;
});

function appendMessage(message, shouldScroll) {
  if (
    !message ||
    !/^[0-9]{1,12}$/.test(String(message.nickname ?? '')) ||
    !/^[0-9]{1,200}$/.test(String(message.text ?? ''))
  ) return;

  const item = document.createElement('article');
  item.className = 'message';

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = message.nickname.slice(-2).padStart(2, '0');

  const body = document.createElement('div');
  body.className = 'message-body';

  const meta = document.createElement('div');
  meta.className = 'message-meta';

  const nickname = document.createElement('strong');
  nickname.className = 'message-nickname';
  nickname.textContent = message.nickname;

  const time = document.createElement('time');
  time.className = 'message-time';
  time.dateTime = message.createdAt;
  time.textContent = formatTime(message.createdAt);

  const text = document.createElement('p');
  text.className = 'message-text';
  text.textContent = message.text;

  meta.append(nickname, time);
  body.append(meta, text);
  item.append(avatar, body);
  messageList.append(item);

  if (shouldScroll || isNearBottom()) scrollToBottom();
}

function keepDigits(value, maximumLength) {
  return String(value).replace(/[^0-9]/g, '').slice(0, maximumLength);
}

function formatTime(isoText) {
  const date = new Date(isoText);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function showStatus(text, isError) {
  statusMessage.textContent = text;
  statusMessage.classList.toggle('error', Boolean(isError));
}

function clearStatus() {
  statusMessage.textContent = '';
  statusMessage.classList.remove('error');
}

function setSending(isSending) {
  sendButton.disabled = isSending;
  sendButton.textContent = isSending ? '전송 중' : '보내기';
}

function isNearBottom() {
  return messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < 120;
}

function scrollToBottom() {
  messageList.scrollTop = messageList.scrollHeight;
}

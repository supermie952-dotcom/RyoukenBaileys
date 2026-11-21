import {
  proto,
  WASocket,
  AnyMessageContent,
  MiscMessageGenerationOptions,
} from '@whiskeysockets/baileys';

export function extractText(msg: proto.IWebMessageInfo): string {
  const m = msg.message;
  if (!m) return '';

  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    ''
  ).trim();
}

export function extractMessageType(msg: proto.IWebMessageInfo): string {
  const m = msg.message;
  if (!m) return 'unknown';
  const keys = Object.keys(m).filter(
    (k) => k !== 'senderKeyDistributionMessage' && k !== 'messageContextInfo'
  );
  return keys[0] || 'unknown';
}

export async function sendRawMessage(
  sock: WASocket,
  jid: string,
  content: AnyMessageContent,
  options?: MiscMessageGenerationOptions
) {
  return sock.sendMessage(jid, content, options);
}

export async function sendTextMessage(
  sock: WASocket,
  jid: string,
  text: string,
  options?: MiscMessageGenerationOptions
) {
  return sock.sendMessage(jid, { text }, options);
}

export async function replyTextMessage(
  sock: WASocket,
  msg: proto.IWebMessageInfo,
  text: string,
  options?: MiscMessageGenerationOptions
) {
  const jid = msg.key.remoteJid;
  if (!jid) return undefined;
  return sock.sendMessage(jid, { text }, { quoted: msg, ...options });
}

export async function sendImageMessage(
  sock: WASocket,
  jid: string,
  image: Buffer | { url: string },
  caption?: string,
  quoted?: proto.IWebMessageInfo
) {
  return sock.sendMessage(jid, { image, caption }, quoted ? { quoted } : undefined);
}

export async function sendVideoMessage(
  sock: WASocket,
  jid: string,
  video: Buffer | { url: string },
  caption?: string,
  quoted?: proto.IWebMessageInfo
) {
  return sock.sendMessage(jid, { video, caption }, quoted ? { quoted } : undefined);
}

export async function sendAudioMessage(
  sock: WASocket,
  jid: string,
  audio: Buffer | { url: string },
  ptt = false,
  quoted?: proto.IWebMessageInfo
) {
  return sock.sendMessage(
    jid,
    { audio, ptt, mimetype: ptt ? 'audio/ogg; codecs=opus' : 'audio/mpeg' },
    quoted ? { quoted } : undefined
  );
}

export async function sendDocumentMessage(
  sock: WASocket,
  jid: string,
  document: Buffer | { url: string },
  fileName: string,
  mimetype = 'application/octet-stream',
  caption?: string,
  quoted?: proto.IWebMessageInfo
) {
  return sock.sendMessage(
    jid,
    { document, fileName, mimetype, caption },
    quoted ? { quoted } : undefined
  );
}

export async function reactToMessage(
  sock: WASocket,
  msg: proto.IWebMessageInfo,
  emoji: string
) {
  const jid = msg.key.remoteJid;
  if (!jid) return undefined;
  return sock.sendMessage(jid, {
    react: { text: emoji, key: msg.key },
  });
}

export async function editMessageText(
  sock: WASocket,
  msg: proto.IWebMessageInfo,
  text: string
) {
  const jid = msg.key.remoteJid;
  if (!jid) return undefined;
  return sock.sendMessage(jid, {
    text,
    edit: msg.key,
  });
}

export async function deleteMessage(
  sock: WASocket,
  msg: proto.IWebMessageInfo
) {
  const jid = msg.key.remoteJid;
  if (!jid) return undefined;
  return sock.sendMessage(jid, { delete: msg.key });
}

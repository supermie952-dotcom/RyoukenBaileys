import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  WASocket,
  proto,
  BaileysEventMap,
  jidNormalizedUser,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import {
  RyoukenConfig,
  RyoukenMessageContext,
  RyoukenMessageHandler,
  RyoukenEventHandler,
} from './types';
import {
  extractText,
  extractMessageType,
  replyTextMessage,
  reactToMessage,
  sendRawMessage,
  sendTextMessage,
  sendImageMessage,
  sendVideoMessage,
  sendAudioMessage,
  sendDocumentMessage,
  editMessageText,
  deleteMessage,
} from './helpers';

export class RyoukenClient {
  public sock!: WASocket;
  public config: Required<
    Pick<
      RyoukenConfig,
      | 'sessionDir'
      | 'authMethod'
      | 'phoneNumber'
      | 'customPairingCode'
      | 'browser'
      | 'logLevel'
      | 'autoReconnect'
      | 'reconnectDelayMs'
    >
  > &
    RyoukenConfig;

  private messageHandlers: RyoukenMessageHandler[] = [];
  private isConnecting = false;
  private pairingRequested = false;

  constructor(config: RyoukenConfig = {}) {
    this.config = {
      ...config,
      sessionDir: config.sessionDir ?? './auth_session',
      authMethod: config.authMethod ?? 'qr',
      phoneNumber: config.phoneNumber ?? '',
      customPairingCode: config.customPairingCode ?? '',
      browser: config.browser ?? ['RyoukenBaileys', 'Chrome', '1.0.0'],
      logLevel: config.logLevel ?? 'silent',
      autoReconnect: config.autoReconnect ?? true,
      reconnectDelayMs: config.reconnectDelayMs ?? 3000,
    };
  }

  async connect(): Promise<WASocket> {
    if (this.isConnecting) return this.sock;
    this.isConnecting = true;
    this.pairingRequested = false;

    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.config.sessionDir);
      const { version } = await fetchLatestBaileysVersion();
      const logger = pino({ level: this.config.logLevel });
      const usePairing = this.config.authMethod === 'pairing';

      this.sock = makeWASocket({
        version,
        auth: state,
        logger,
        printQRInTerminal: !usePairing && !this.config.onQR,
        browser: this.config.browser,
        ...this.config.socketOptions,
      });

      this.sock.ev.on('creds.update', saveCreds);

      if (usePairing && !this.sock.authState.creds.registered) {
        if (!this.config.phoneNumber) {
          throw new Error('phoneNumber wajib diisi saat authMethod = "pairing"');
        }
        const cleanNumber = this.config.phoneNumber.replace(/[^0-9]/g, '');

        setTimeout(async () => {
          if (this.pairingRequested || this.sock.authState.creds.registered) return;
          this.pairingRequested = true;

          const code = this.config.customPairingCode
            ? await this.sock.requestPairingCode(cleanNumber, this.config.customPairingCode)
            : await this.sock.requestPairingCode(cleanNumber);

          if (this.config.onPairingCode) {
            await this.config.onPairingCode(code);
          } else {
            console.log(`[RyoukenBaileys] Pairing Code (${cleanNumber}): ${code}`);
          }
        }, 2500);
      }

      this.sock.ev.on('connection.update', async (update) => {
        if (update.qr && this.config.onQR) {
          await this.config.onQR(update.qr);
        }

        if (this.config.onConnectionUpdate) {
          await this.config.onConnectionUpdate(update);
        }

        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
          this.isConnecting = false;
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;

          if (isLoggedOut) {
            console.log('[RyoukenBaileys] Session logged out. Hapus folder session lalu login ulang.');
            return;
          }

          if (this.config.autoReconnect) {
            console.log(
              `[RyoukenBaileys] Koneksi putus (code: ${statusCode ?? 'unknown'}). Reconnect dalam ${this.config.reconnectDelayMs}ms...`
            );
            setTimeout(() => {
              this.connect().catch((err) =>
                console.error('[RyoukenBaileys] Gagal reconnect:', err)
              );
            }, this.config.reconnectDelayMs);
          }
        } else if (connection === 'open') {
          this.isConnecting = false;
          console.log('[RyoukenBaileys] Terhubung ke WhatsApp!');
        }
      });

      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify' && type !== 'append') return;

        for (const msg of messages) {
          if (!msg.message) continue;
          const chatId = msg.key.remoteJid || '';
          const isGroup = chatId.endsWith('@g.us');
          const fromMe = Boolean(msg.key.fromMe);
          const rawSender = isGroup
            ? msg.key.participant || chatId
            : fromMe
              ? this.sock.user?.id || chatId
              : chatId;
          const senderId = jidNormalizedUser(rawSender);

          const ctx: RyoukenMessageContext = {
            sock: this.sock,
            msg,
            chatId,
            senderId,
            isGroup,
            fromMe,
            text: extractText(msg),
            type: extractMessageType(msg),
            reply: (text, options) => replyTextMessage(this.sock, msg, text, options),
            react: (emoji) => reactToMessage(this.sock, msg, emoji),
          };

          for (const handler of this.messageHandlers) {
            await handler(ctx);
          }
        }
      });

      return this.sock;
    } catch (err) {
      this.isConnecting = false;
      throw err;
    }
  }

  onMessage(handler: RyoukenMessageHandler) {
    this.messageHandlers.push(handler);
    return this;
  }

  onEvent<T extends keyof BaileysEventMap>(event: T, handler: RyoukenEventHandler<T>) {
    this.sock.ev.on(event, handler);
    return this;
  }

  async logout() {
    if (this.sock) {
      await this.sock.logout();
    }
  }

  async close(reason = 'Closed by client') {
    if (this.sock) {
      await this.sock.end(new Error(reason));
    }
  }

  sendRaw = (
    jid: string,
    content: Parameters<typeof sendRawMessage>[2],
    options?: Parameters<typeof sendRawMessage>[3]
  ) => sendRawMessage(this.sock, jid, content, options);

  sendText = (
    jid: string,
    text: string,
    options?: Parameters<typeof sendTextMessage>[3]
  ) => sendTextMessage(this.sock, jid, text, options);

  reply = (
    msg: proto.IWebMessageInfo,
    text: string,
    options?: Parameters<typeof replyTextMessage>[3]
  ) => replyTextMessage(this.sock, msg, text, options);

  sendImage = (
    jid: string,
    image: Buffer | { url: string },
    caption?: string,
    quoted?: proto.IWebMessageInfo
  ) => sendImageMessage(this.sock, jid, image, caption, quoted);

  sendVideo = (
    jid: string,
    video: Buffer | { url: string },
    caption?: string,
    quoted?: proto.IWebMessageInfo
  ) => sendVideoMessage(this.sock, jid, video, caption, quoted);

  sendAudio = (
    jid: string,
    audio: Buffer | { url: string },
    ptt = false,
    quoted?: proto.IWebMessageInfo
  ) => sendAudioMessage(this.sock, jid, audio, ptt, quoted);

  sendDocument = (
    jid: string,
    document: Buffer | { url: string },
    fileName: string,
    mimetype?: string,
    caption?: string,
    quoted?: proto.IWebMessageInfo
  ) => sendDocumentMessage(this.sock, jid, document, fileName, mimetype, caption, quoted);

  react = (msg: proto.IWebMessageInfo, emoji: string) => reactToMessage(this.sock, msg, emoji);

  editMessage = (msg: proto.IWebMessageInfo, text: string) => editMessageText(this.sock, msg, text);

  deleteMessage = (msg: proto.IWebMessageInfo) => deleteMessage(this.sock, msg);
}

import {
  proto,
  WASocket,
  ConnectionState,
  BaileysEventMap,
} from '@whiskeysockets/baileys';

export type RyouAuthMethod = 'qr' | 'pairing';

export interface RyoukenConfig {
  /** Folder penyimpanan session/auth */
  sessionDir?: string;
  /** Metode login: 'qr' atau 'pairing' */
  authMethod?: RyouAuthMethod;
  /** Nomor WA untuk pairing code, contoh: '6281234567890' */
  phoneNumber?: string;
  /** Kode pairing custom 8 karakter (opsional) */
  customPairingCode?: string;
  /** Identitas browser [name, platform, version] */
  browser?: [string, string, string];
  /** Level log pino */
  logLevel?: 'silent' | 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  /** Otomatis reconnect jika koneksi putus */
  autoReconnect?: boolean;
  /** Jeda reconnect dalam ms */
  reconnectDelayMs?: number;
  /** Opsi tambahan untuk makeWASocket */
  socketOptions?: Record<string, any>;
  /** Callback saat QR string tersedia */
  onQR?: (qr: string) => void | Promise<void>;
  /** Callback saat Pairing Code tersedia */
  onPairingCode?: (code: string) => void | Promise<void>;
  /** Callback perubahan status koneksi */
  onConnectionUpdate?: (state: Partial<ConnectionState>) => void | Promise<void>;
}

export interface RyoukenMessageContext {
  sock: WASocket;
  msg: proto.IWebMessageInfo;
  chatId: string;
  senderId: string;
  isGroup: boolean;
  fromMe: boolean;
  text: string;
  type: string;
  reply: (text: string, options?: Record<string, any>) => Promise<proto.WebMessageInfo | undefined>;
  react: (emoji: string) => Promise<proto.WebMessageInfo | undefined>;
}

export type RyoukenMessageHandler = (ctx: RyoukenMessageContext) => void | Promise<void>;
export type RyoukenEventHandler<T extends keyof BaileysEventMap> = (
  data: BaileysEventMap[T]
) => void | Promise<void>;

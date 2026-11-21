import {
  proto,
  WASocket,
  WAMessage,
  ConnectionState,
  BaileysEventMap,
} from '@whiskeysockets/baileys';

export type RyouAuthMethod = 'qr' | 'pairing';

export interface RyoukenConfig {
  sessionDir?: string;
  authMethod?: RyouAuthMethod;
  phoneNumber?: string;
  customPairingCode?: string;
  browser?: [string, string, string];
  logLevel?: 'silent' | 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  autoReconnect?: boolean;
  reconnectDelayMs?: number;
  socketOptions?: Record<string, any>;
  onQR?: (qr: string) => void | Promise<void>;
  onPairingCode?: (code: string) => void | Promise<void>;
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
  reply: (text: string, options?: Record<string, any>) => Promise<WAMessage | undefined>;
  react: (emoji: string) => Promise<WAMessage | undefined>;
}

export type RyoukenMessageHandler = (ctx: RyoukenMessageContext) => void | Promise<void>;
export type RyoukenEventHandler<T extends keyof BaileysEventMap> = (
  data: BaileysEventMap[T]
) => void | Promise<void>;

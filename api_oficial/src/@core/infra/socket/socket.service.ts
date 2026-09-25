import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import {
  IReceivedWhatsppOficial,
  IReceivedWhatsppOficialRead,
  IOfficialCallWhatsAppOficial,
} from 'src/@core/interfaces/IWebsocket.interface';

interface QueueItem {
  type: 'message' | 'read' | 'officialCall';
  data:
    | IReceivedWhatsppOficial
    | IReceivedWhatsppOficialRead
    | IOfficialCallWhatsAppOficial;
  timestamp: number;
}

interface CompanyQueue {
  items: QueueItem[];
  processing: boolean;
  socket: Socket | null;
  cleanupTimer: NodeJS.Timeout | null;
}

@Injectable()
export class SocketService implements OnModuleDestroy {
  private url: string;
  private companyQueues: Map<number, CompanyQueue> = new Map();
  private readonly DELAY_BETWEEN_MESSAGES = 200;
  private readonly SOCKET_CLEANUP_DELAY = 5000;

  private logger: Logger = new Logger(`${SocketService.name}`);

  constructor() {}

  onModuleDestroy() {
    this.companyQueues.forEach((queue, companyId) => {
      if (queue.cleanupTimer) {
        clearTimeout(queue.cleanupTimer);
      }

      if (queue.socket) {
        this.logger.warn(
          `Fechando socket da empresa ${companyId} ao destruir módulo`,
        );
        queue.socket.close();
      }
    });

    this.companyQueues.clear();
  }

  private getOrCreateQueue(companyId: number): CompanyQueue {
    if (!this.companyQueues.has(companyId)) {
      this.companyQueues.set(companyId, {
        items: [],
        processing: false,
        socket: null,
        cleanupTimer: null,
      });
    }

    return this.companyQueues.get(companyId)!;
  }

  private async getOrCreateSocket(companyId: number): Promise<Socket> {
    try {
      this.url = process.env.URL_BACKEND_MULT100;

      if (!this.url) {
        throw new Error('Nenhuma configuração do url do backend');
      }

      const queue = this.getOrCreateQueue(companyId);

      if (queue.cleanupTimer) {
        this.logger.log(
          `Cancelando cleanup agendado para empresa ${companyId} - nova atividade detectada`,
        );
        clearTimeout(queue.cleanupTimer);
        queue.cleanupTimer = null;
      }

      if (queue.socket && queue.socket.connected) {
        this.logger.log(`Reutilizando socket conectado para empresa ${companyId}`);
        return queue.socket;
      }

      if (queue.socket && !queue.socket.connected) {
        this.logger.warn(
          `Socket desconectado encontrado para empresa ${companyId}, criando novo...`,
        );
        queue.socket.close();
        queue.socket = null;
      }

      this.logger.log(`Criando novo socket para empresa ${companyId}`);

      const socket = io(`${this.url}/${companyId}`, {
        query: {
          token: `Bearer ${process.env.TOKEN_ADMIN || ''}`,
        },
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
      });

      this.setupSocketEvents(socket, companyId);
      queue.socket = socket;

      await this.waitForConnection(socket, companyId);

      return socket;
    } catch (error: any) {
      this.logger.error(
        `Erro ao conectar com o websocket da API Mult100 - ${error.message}`,
      );
      throw error;
    }
  }

  private waitForConnection(socket: Socket, companyId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (socket.connected) {
        this.logger.log(`Socket já conectado para empresa ${companyId}`);
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        this.logger.error(`Timeout ao conectar socket da empresa ${companyId}`);
        reject(new Error('Timeout ao conectar socket'));
      }, 5000);

      socket.once('connect', () => {
        clearTimeout(timeout);
        this.logger.log(`Socket conectado com sucesso para empresa ${companyId}`);
        resolve();
      });

      socket.once('connect_error', (error) => {
        clearTimeout(timeout);
        this.logger.error(
          `Erro ao conectar socket da empresa ${companyId}: ${error}`,
        );
        reject(error);
      });
    });
  }

  private isValidCompanyId(companyId: any): boolean {
    return Number.isFinite(Number(companyId)) && Number(companyId) > 0;
  }

  private isValidString(value: any): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private shouldQueueReadEvent(data: any): boolean {
    if (!data) {
      return false;
    }

    if (!this.isValidCompanyId(data.companyId)) {
      this.logger.warn(
        `[SocketService] Evento de leitura ignorado: companyId inválido`,
      );
      return false;
    }

    if (!this.isValidString(data.messageId)) {
      this.logger.warn(
        `[SocketService] Evento de leitura ignorado: messageId inválido`,
      );
      return false;
    }

    if (!this.isValidString(data.token)) {
      this.logger.warn(
        `[SocketService] Evento de leitura ignorado: token inválido`,
      );
      return false;
    }

    const status =
      typeof data.status === 'string' ? data.status.trim().toLowerCase() : '';

    if (status && status !== 'read') {
      this.logger.warn(
        `[SocketService] Evento de leitura ignorado para status "${status}" do messageId=${data.messageId}`,
      );
      return false;
    }

    return true;
  }

  private alreadyQueuedRead(
    companyId: number,
    messageId: string,
    token: string,
  ): boolean {
    const queue = this.getOrCreateQueue(companyId);

    return queue.items.some((item) => {
      if (item.type !== 'read') {
        return false;
      }

      const readItem = item.data as IReceivedWhatsppOficialRead & {
        messageId?: string;
        token?: string;
      };

      return readItem.messageId === messageId && readItem.token === token;
    });
  }

  sendMessage(data: IReceivedWhatsppOficial) {
    const companyId = Number((data as any)?.companyId);

    if (!this.isValidCompanyId(companyId)) {
      this.logger.warn(
        `[SocketService] Mensagem ignorada: companyId inválido`,
      );
      return;
    }

    const queue = this.getOrCreateQueue(companyId);

    if (queue.cleanupTimer) {
      clearTimeout(queue.cleanupTimer);
      queue.cleanupTimer = null;
    }

    queue.items.push({
      type: 'message',
      data,
      timestamp: Date.now(),
    });

    this.logger.log(
      `📥 Mensagem adicionada à fila da empresa ${companyId}. Total na fila: ${queue.items.length}`,
    );

    if (!queue.processing) {
      this.processQueue(companyId);
    }
  }

  readMessage(data: IReceivedWhatsppOficialRead) {
    const payload = data as IReceivedWhatsppOficialRead & {
      companyId?: number;
      messageId?: string;
      token?: string;
      status?: string;
    };

    if (!this.shouldQueueReadEvent(payload)) {
      return;
    }

    const companyId = Number(payload.companyId);
    const messageId = String(payload.messageId);
    const token = String(payload.token);

    if (this.alreadyQueuedRead(companyId, messageId, token)) {
      this.logger.warn(
        `[SocketService] Evento de leitura duplicado ignorado para empresa ${companyId} e messageId=${messageId}`,
      );
      return;
    }

    const queue = this.getOrCreateQueue(companyId);

    if (queue.cleanupTimer) {
      clearTimeout(queue.cleanupTimer);
      queue.cleanupTimer = null;
    }

    queue.items.push({
      type: 'read',
      data,
      timestamp: Date.now(),
    });

    this.logger.log(
      `📖 Evento de leitura adicionado à fila da empresa ${companyId}. Total na fila: ${queue.items.length}`,
    );

    if (!queue.processing) {
      this.processQueue(companyId);
    }
  }

  sendOfficialCall(data: IOfficialCallWhatsAppOficial) {
    const companyId = Number((data as any)?.companyId);

    if (!this.isValidCompanyId(companyId)) {
      this.logger.warn(
        `[SocketService] Chamada oficial ignorada: companyId inválido`,
      );
      return;
    }

    const queue = this.getOrCreateQueue(companyId);

    if (queue.cleanupTimer) {
      clearTimeout(queue.cleanupTimer);
      queue.cleanupTimer = null;
    }

    queue.items.push({
      type: 'officialCall',
      data,
      timestamp: Date.now(),
    });

    this.logger.log(
      `📞 Chamada oficial adicionada à fila da empresa ${companyId}. Total na fila: ${queue.items.length}`,
    );

    if (!queue.processing) {
      this.processQueue(companyId);
    }
  }

  private async processQueue(companyId: number): Promise<void> {
    const queue = this.getOrCreateQueue(companyId);
    queue.processing = true;

    try {
      this.logger.log(
        `🔄 Iniciando processamento da fila para empresa ${companyId}`,
      );

      const socket = await this.getOrCreateSocket(companyId);
      let processedCount = 0;

      while (queue.items.length > 0) {
        const item = queue.items.shift();

        if (!item) {
          break;
        }

        try {
          if (!socket.connected) {
            this.logger.error(
              `❌ Socket desconectado ao processar item da empresa ${companyId}, aguardando reconexão...`,
            );
            await this.waitForConnection(socket, companyId);
          }

          if (item.type === 'message') {
            const data = item.data as IReceivedWhatsppOficial;

            this.logger.log(
              `📤 [${processedCount + 1}] Enviando mensagem para o websocket da empresa ${companyId}`,
            );

            socket.emit('receivedMessageWhatsAppOficial', data);

            this.logger.log(
              `✅ Mensagem emitida com sucesso para empresa ${companyId}`,
            );
          } else if (item.type === 'read') {
            const data = item.data as IReceivedWhatsppOficialRead & {
              messageId?: string;
            };

            this.logger.log(
              `📤 [${processedCount + 1}] Enviando evento de leitura para o websocket da empresa ${companyId} messageId=${data.messageId || 'N/A'}`,
            );

            socket.emit('readMessageWhatsAppOficial', data);

            this.logger.log(
              `✅ Evento de leitura emitido com sucesso para empresa ${companyId}`,
            );
          } else if (item.type === 'officialCall') {
            const data = item.data as IOfficialCallWhatsAppOficial;

            this.logger.log(
              `📤 [${processedCount + 1}] Enviando chamada oficial para o websocket da empresa ${companyId}`,
            );

            socket.emit('officialCallWhatsAppOficial', data);

            this.logger.log(
              `✅ Chamada oficial emitida com sucesso para empresa ${companyId}`,
            );
          }

          processedCount++;

          if (queue.items.length > 0) {
            this.logger.log(
              `⏳ Aguardando ${this.DELAY_BETWEEN_MESSAGES}ms antes do próximo item...`,
            );
            await this.delay(this.DELAY_BETWEEN_MESSAGES);
          }
        } catch (error: any) {
          this.logger.error(
            `❌ Erro ao processar item da fila da empresa ${companyId}: ${error.message}`,
          );
        }
      }

      this.logger.log(
        `✨ Processamento concluído! ${processedCount} itens enviados para empresa ${companyId}`,
      );

      this.scheduleSocketCleanup(companyId);
    } catch (error: any) {
      this.logger.error(
        `❌ Erro ao processar fila da empresa ${companyId}: ${error.message}`,
      );
    } finally {
      queue.processing = false;
    }
  }

  private scheduleSocketCleanup(companyId: number): void {
    const queue = this.getOrCreateQueue(companyId);

    if (queue.cleanupTimer) {
      clearTimeout(queue.cleanupTimer);
    }

    queue.cleanupTimer = setTimeout(() => {
      const currentQueue = this.getOrCreateQueue(companyId);

      if (
        currentQueue.items.length === 0 &&
        !currentQueue.processing &&
        currentQueue.socket
      ) {
        this.logger.warn(
          `🔌 Fechando socket da empresa ${companyId} por inatividade (${this.SOCKET_CLEANUP_DELAY}ms sem atividade)`,
        );
        currentQueue.socket.close();
        currentQueue.socket = null;
        currentQueue.cleanupTimer = null;
      }
    }, this.SOCKET_CLEANUP_DELAY);

    this.logger.log(
      `⏰ Cleanup agendado para empresa ${companyId} em ${this.SOCKET_CLEANUP_DELAY}ms`,
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private setupSocketEvents(socket: Socket, companyId: number): void {
    socket.on('connect', () => {
      this.logger.log(
        `Conectado ao websocket do servidor ${this.url}/${companyId}`,
      );
    });

    socket.on('connect_error', (error) => {
      this.logger.error(`Erro de conexão empresa ${companyId}: ${error}`);
    });

    socket.on('disconnect', () => {
      this.logger.warn(
        `Desconectado do websocket do servidor ${this.url}/${companyId}`,
      );
    });
  }
}
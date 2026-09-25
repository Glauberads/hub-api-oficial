/**
 * SimpleObjectCache — cache TTL leve em memória (inspirado no Ticketz).
 * Útil para queries repetitivas como horário de funcionamento, contatos de grupo, etc.
 * Diferente do NodeCache: sem dependências, interface mínima, zero overhead.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class SimpleObjectCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly defaultTTL: number;
  private cleanupTimer: NodeJS.Timer | null = null;

  /**
   * @param defaultTTLSeconds TTL padrão em segundos (default: 300 = 5 min)
   * @param cleanupIntervalSeconds Intervalo de limpeza de expirados (default: 60s)
   */
  constructor(defaultTTLSeconds: number = 300, cleanupIntervalSeconds: number = 60) {
    this.defaultTTL = defaultTTLSeconds * 1000;

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalSeconds * 1000);

    // Não bloquear o event loop
    if ((this.cleanupTimer as any).unref) {
      (this.cleanupTimer as any).unref();
    }
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTTL;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  del(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Get or fetch: retorna do cache se existir, senão executa fetcher e armazena.
   */
  async getOrFetch(key: string, fetcher: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const value = await fetcher();
    this.set(key, value, ttlSeconds);
    return value;
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
  }
}

// ============ Instâncias globais reutilizáveis ============

/** Cache para horário de funcionamento (TTL 2 min) */
export const scheduleCache = new SimpleObjectCache(120);

/** Cache para metadados gerais (TTL 5 min) */
export const metadataCache = new SimpleObjectCache(300);

/** Cache para contatos de grupo (TTL 10 min) */
export const groupContactsCache = new SimpleObjectCache(600);

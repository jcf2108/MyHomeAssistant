import type {
  HaAreaEntry,
  HaConnectionStatus,
  HaDeviceRegistryEntry,
  HaEntity,
  HaEntityRegistryEntry,
  HaOverviewMetadata,
  LovelaceConfig,
  LovelaceDashboardInfo,
} from '../types/ha';

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
}

export interface HaClientCallbacks {
  onStatusChange: (status: HaConnectionStatus, errorDetail?: string) => void;
  onStatesSnapshot: (entities: Record<string, HaEntity>) => void;
  onEntityUpdate: (entity: HaEntity) => void;
  onOverviewMetadata?: (meta: HaOverviewMetadata) => void;
}

export function normalizeHaBaseUrl(rawUrl: string): string {
  let clean = rawUrl.trim().replace(/\/+$/, '');
  if (!clean) return '';
  if (!/^https?:\/\//i.test(clean)) {
    clean = `http://${clean}`;
  }
  return clean;
}

export function buildHaWebSocketUrl(rawUrl: string): string {
  const base = normalizeHaBaseUrl(rawUrl);
  if (!base) return '';
  const wsBase = base.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
  return `${wsBase}/api/websocket`;
}

export function resolveHaMediaUrl(baseUrl: string, entityPicture?: string): string | null {
  if (!entityPicture) return null;
  if (/^https?:\/\//i.test(entityPicture) || entityPicture.startsWith('data:')) {
    return entityPicture;
  }
  const normalized = normalizeHaBaseUrl(baseUrl);
  if (!normalized) return null;
  return `${normalized}${entityPicture.startsWith('/') ? '' : '/'}${entityPicture}`;
}

export class HomeAssistantWsClient {
  private ws: WebSocket | null = null;
  private baseUrl = '';
  private token = '';
  private dashboardUrlPath: string | null = null;
  private callbacks: HaClientCallbacks;
  private msgId = 1;
  private pending = new Map<number, PendingRequest>();
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private reconnectAttempt = 0;
  private intentionalClose = false;

  constructor(callbacks: HaClientCallbacks) {
    this.callbacks = callbacks;
  }

  public connect(rawUrl: string, token: string, dashboardUrlPath: string | null = null): void {
    this.disconnect();
    const wsUrl = buildHaWebSocketUrl(rawUrl);
    if (!wsUrl || !token.trim()) {
      this.callbacks.onStatusChange('unconfigured');
      return;
    }

    this.baseUrl = normalizeHaBaseUrl(rawUrl);
    this.token = token.trim();
    this.dashboardUrlPath = dashboardUrlPath;
    this.intentionalClose = false;
    this.openSocket();
  }

  public disconnect(): void {
    this.intentionalClose = true;
    this.clearTimers();
    this.rejectAllPending('Connexion fermée');
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore close error
      }
      this.ws = null;
    }
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public async setDashboardPath(urlPath: string | null): Promise<void> {
    this.dashboardUrlPath = urlPath;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      await this.fetchOverviewMetadata();
    }
  }

  public async refreshOverview(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      await this.fetchOverviewMetadata(true);
    }
  }

  public async callService(
    domain: string,
    service: string,
    serviceData: Record<string, unknown> = {},
    target?: { entity_id: string | string[] },
  ): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Non connecté');
    }
    await this.sendCommand({
      type: 'call_service',
      domain,
      service,
      service_data: serviceData,
      ...(target ? { target } : {}),
    });
  }

  private openSocket(): void {
    const wsUrl = buildHaWebSocketUrl(this.baseUrl);
    if (!wsUrl) return;

    this.callbacks.onStatusChange('connecting');
    try {
      this.ws = new WebSocket(wsUrl);
    } catch {
      this.callbacks.onStatusChange('disconnected', 'URL invalide');
      return;
    }

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as Record<string, unknown>;
        this.handleMessage(msg);
      } catch {
        // ignore malformed frame
      }
    };

    this.ws.onerror = () => {
      // handled on close
    };

    this.ws.onclose = () => {
      this.clearTimers();
      this.rejectAllPending('Déconnecté');
      if (this.intentionalClose) return;
      this.callbacks.onStatusChange('disconnected');
      this.scheduleReconnect();
    };
  }

  private handleMessage(msg: Record<string, unknown>): void {
    const type = msg.type as string | undefined;

    if (type === 'auth_required') {
      this.ws?.send(
        JSON.stringify({
          type: 'auth',
          access_token: this.token,
        }),
      );
      return;
    }

    if (type === 'auth_invalid') {
      this.intentionalClose = true;
      this.callbacks.onStatusChange('auth_error', 'Jeton refusé');
      this.ws?.close();
      return;
    }

    if (type === 'auth_ok') {
      this.reconnectAttempt = 0;
      this.callbacks.onStatusChange('connected');
      this.startHeartbeat();
      void this.bootstrapStatesAndEvents();
      return;
    }

    if (type === 'result' && typeof msg.id === 'number') {
      const req = this.pending.get(msg.id);
      if (req) {
        this.pending.delete(msg.id);
        if (msg.success) {
          req.resolve(msg.result);
        } else {
          const errObj = msg.error as { message?: string; code?: string } | undefined;
          req.reject(new Error(errObj?.code || errObj?.message || 'Erreur service HA'));
        }
      }
      return;
    }

    if (type === 'event') {
      const eventObj = msg.event as
        | {
            event_type?: string;
            data?: { entity_id?: string; new_state?: HaEntity | null; url_path?: string | null };
          }
        | undefined;

      if (eventObj?.event_type === 'state_changed' && eventObj.data?.new_state) {
        this.callbacks.onEntityUpdate(eventObj.data.new_state);
      } else if (eventObj?.event_type === 'lovelace_updated') {
        void this.fetchOverviewMetadata(true);
      }
    }
  }

  private async bootstrapStatesAndEvents(): Promise<void> {
    try {
      const states = (await this.sendCommand({ type: 'get_states' })) as HaEntity[];
      const allMap: Record<string, HaEntity> = {};
      if (Array.isArray(states)) {
        for (const item of states) {
          if (!item?.entity_id) continue;
          allMap[item.entity_id] = item;
        }
      }
      this.callbacks.onStatesSnapshot(allMap);

      await this.sendCommand({
        type: 'subscribe_events',
        event_type: 'state_changed',
      });

      void this.sendCommand({
        type: 'subscribe_events',
        event_type: 'lovelace_updated',
      }).catch(() => {});

      await this.fetchOverviewMetadata();
    } catch {
      // socket close will trigger retry if needed
    }
  }

  private async fetchOverviewMetadata(force = false): Promise<void> {
    if (!this.callbacks.onOverviewMetadata) return;

    const [dashboardsRes, lovelaceRes, areasRes, entityRegRes, deviceRegRes] =
      await Promise.allSettled([
        this.sendCommand({ type: 'lovelace/dashboards/list' }),
        this.sendCommand({
          type: 'lovelace/config',
          force,
          ...(this.dashboardUrlPath ? { url_path: this.dashboardUrlPath } : {}),
        }),
        this.sendCommand({ type: 'config/area_registry/list' }),
        this.sendCommand({ type: 'config/entity_registry/list' }),
        this.sendCommand({ type: 'config/device_registry/list' }),
      ]);

    const dashboards: LovelaceDashboardInfo[] = [
      { id: 'default', url_path: null, title: 'Aperçu (par défaut)' },
    ];
    if (dashboardsRes.status === 'fulfilled' && Array.isArray(dashboardsRes.value)) {
      for (const raw of dashboardsRes.value as Array<Record<string, unknown>>) {
        const urlPath = typeof raw.url_path === 'string' ? raw.url_path : null;
        if (!urlPath) continue;
        dashboards.push({
          id: String(raw.id || urlPath),
          url_path: urlPath,
          title: String(raw.title || urlPath),
          icon: typeof raw.icon === 'string' ? raw.icon : undefined,
          show_in_sidebar: Boolean(raw.show_in_sidebar ?? true),
        });
      }
    }

    let lovelaceConfig: LovelaceConfig | null = null;
    if (
      lovelaceRes.status === 'fulfilled' &&
      lovelaceRes.value &&
      typeof lovelaceRes.value === 'object'
    ) {
      const cfg = lovelaceRes.value as LovelaceConfig;
      if (Array.isArray(cfg.views)) {
        lovelaceConfig = cfg;
      }
    }

    const areas: HaAreaEntry[] =
      areasRes.status === 'fulfilled' && Array.isArray(areasRes.value)
        ? (areasRes.value as HaAreaEntry[])
        : [];

    const entityRegistry: Record<string, HaEntityRegistryEntry> = {};
    if (entityRegRes.status === 'fulfilled' && Array.isArray(entityRegRes.value)) {
      for (const item of entityRegRes.value as HaEntityRegistryEntry[]) {
        if (item?.entity_id) {
          entityRegistry[item.entity_id] = item;
        }
      }
    }

    const deviceRegistry: Record<string, HaDeviceRegistryEntry> = {};
    if (deviceRegRes.status === 'fulfilled' && Array.isArray(deviceRegRes.value)) {
      for (const dev of deviceRegRes.value as HaDeviceRegistryEntry[]) {
        if (dev?.id) {
          deviceRegistry[dev.id] = dev;
        }
      }
    }

    this.callbacks.onOverviewMetadata({
      lovelaceConfig,
      dashboards,
      areas,
      entityRegistry,
      deviceRegistry,
    });
  }

  private sendCommand(payload: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Socket fermé'));
        return;
      }
      const id = this.msgId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, ...payload }));
    });
  }

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.pingTimer = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const id = this.msgId++;
        this.ws.send(JSON.stringify({ id, type: 'ping' }));
      }
    }, 30000);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    const delayMs = Math.min(1500 * Math.pow(1.7, this.reconnectAttempt), 20000);
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.intentionalClose) {
        this.openSocket();
      }
    }, delayMs);
  }

  private clearHeartbeat(): void {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearHeartbeat();
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private rejectAllPending(reason: string): void {
    for (const [, req] of this.pending) {
      req.reject(new Error(reason));
    }
    this.pending.clear();
  }
}

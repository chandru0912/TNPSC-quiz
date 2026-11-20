import { Response } from 'express';

export type AnalyticsEventTopic =
  | 'student_registered'
  | 'student_login'
  | 'student_logout'
  | 'student_restored'
  | 'assessment_submitted'
  | 'learning_activity'
  | 'visitor_hit'
  | 'questions_updated'
  | 'subscription_updated'
  | 'payment_event'
  | 'previous_paper_published'
  | 'manual_sync';

interface SseClient {
  id: number;
  res: Response;
  range: string;
  connectedAt: number;
}

class AnalyticsEventBus {
  private clients = new Map<number, SseClient>();
  private nextClientId = 1;
  private pendingTimer: NodeJS.Timeout | null = null;
  private pendingTopics = new Set<AnalyticsEventTopic>();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.heartbeatTimer = setInterval(() => {
      if (this.clients.size === 0) return;
      const deadIds: number[] = [];
      for (const [id, client] of this.clients.entries()) {
        try {
          client.res.write(`: heartbeat ${Date.now()}\n\n`);
        } catch {
          deadIds.push(id);
        }
      }
      for (const id of deadIds) {
        this.clients.delete(id);
      }
    }, 25000);
    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  addClient(res: Response, range: string): number {
    const id = this.nextClientId++;
    this.clients.set(id, { id, res, range, connectedAt: Date.now() });
    this.sendToClient(res, 'connected', {
      clientId: id,
      range,
      serverTime: new Date().toISOString(),
      activeStreams: this.clients.size,
    });
    return id;
  }

  removeClient(id: number): void {
    this.clients.delete(id);
  }

  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Broadcasts a debounced real-time invalidation event to all connected Admin SSE clients.
   * Coalesces rapid bursts (e.g. batch question uploads or multi-hit traffic) within 450ms.
   */
  broadcast(topic: AnalyticsEventTopic, meta?: Record<string, any>): void {
    if (this.clients.size === 0) return;
    this.pendingTopics.add(topic);

    if (this.pendingTimer) return;
    this.pendingTimer = setTimeout(() => {
      const topics = Array.from(this.pendingTopics);
      this.pendingTopics.clear();
      this.pendingTimer = null;

      const payload = {
        topics,
        primaryTopic: topics[topics.length - 1] || topic,
        timestamp: new Date().toISOString(),
        ...(meta ? { meta } : {}),
      };

      const deadIds: number[] = [];
      for (const [id, client] of this.clients.entries()) {
        try {
          this.sendToClient(client.res, 'metrics_updated', payload);
        } catch {
          deadIds.push(id);
        }
      }
      for (const id of deadIds) {
        this.clients.delete(id);
      }
    }, 450);
  }

  private sendToClient(res: Response, eventName: string, data: any): void {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

export const analyticsEventBus = new AnalyticsEventBus();

export function broadcastAnalyticsEvent(
  topic: AnalyticsEventTopic,
  meta?: Record<string, any>
): void {
  try {
    analyticsEventBus.broadcast(topic, meta);
  } catch {
    // Never block primary database transactions on SSE broadcast errors
  }
}

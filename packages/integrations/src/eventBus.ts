import { EventEmitter } from "node:events";

/**
 * Stand-in for the Apache Kafka event stream referenced across the platform
 * (billing events, metering events, payment events). Same publish/subscribe
 * shape as a Kafka client wrapper so a real `kafkajs` producer/consumer can
 * be dropped in without touching call sites.
 */
export class EventBus {
  private readonly emitter = new EventEmitter();

  publish<T>(topic: string, payload: T): void {
    this.emitter.emit(topic, payload);
  }

  subscribe<T>(topic: string, handler: (payload: T) => void): () => void {
    this.emitter.on(topic, handler);
    return () => this.emitter.off(topic, handler);
  }
}

export const platformEventBus = new EventBus();

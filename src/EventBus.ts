import type { EventListener, ICanvasEvent } from "./type";

export class EventBus {
    private listeners: Map<string, Set<EventListener>> = new Map();

    subscribe(eventType: string, listener: EventListener): () => void {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        this.listeners.get(eventType)!.add(listener);
        return () => {
            this.listeners.get(eventType)?.delete(listener);
        };
    }
    once(eventType: string, listener: EventListener): void {
        const u = this.subscribe(eventType, (event) => {
            listener(event);
            u();
        })
    }
    publish(event: ICanvasEvent): void {
        const listeners = this.listeners.get(event.eventType);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(event)
                } catch (e) {
                    console.error('Error:', event.eventType, e);
                }
            });
        }
    }
    unsubscribeAll(eventType?: string) {
        if (eventType) {
            this.listeners.delete(eventType);
        } else {
            this.listeners.clear();
        }
    }
}
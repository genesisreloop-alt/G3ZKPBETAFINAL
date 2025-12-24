type EventHandler<T> = (data: T) => void | Promise<void>;
export declare class EventEmitter<Events extends Record<string, any>> {
    private handlers;
    on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void;
    off<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void;
    emit<K extends keyof Events>(event: K, data: Events[K]): void;
    once<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void;
    removeAllListeners(): void;
}
export {};
//# sourceMappingURL=events.d.ts.map
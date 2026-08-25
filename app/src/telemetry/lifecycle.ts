export interface TelemetryLifecycle {
    shutdown(): Promise<void>;
}

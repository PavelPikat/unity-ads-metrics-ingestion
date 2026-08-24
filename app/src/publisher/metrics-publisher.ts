import type {MetricEvent} from "../domain/metric-event.js";

export interface MetricsPublisher {
    publish(event: MetricEvent): Promise<void>;

    close(): Promise<void>;
}

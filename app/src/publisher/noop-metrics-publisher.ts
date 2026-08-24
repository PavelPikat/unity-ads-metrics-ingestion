import type {MetricEvent} from "../domain/metric-event.js";
import type {MetricsPublisher} from "./metrics-publisher.js";

export class NoopMetricsPublisher implements MetricsPublisher {
    async publish(_event: MetricEvent): Promise<void> {
        // Intentionally empty. A Kafka-backed implementation can replace this.
    }

    async close(): Promise<void> {
        // Nothing to close.
    }
}

import type {MetricEvent} from "../domain/metric-event.js";
import type {MetricsPublisher} from "./metrics-publisher.js";
import type {PublishAdmissionController} from "./publish-admission-controller.js";

export class PublisherOverloadedError extends Error {
    constructor(readonly limit: number) {
        super("Publisher capacity is exhausted");
        this.name = "PublisherOverloadedError";
    }
}

export class ConcurrencyLimitedMetricsPublisher implements MetricsPublisher {
    constructor(
        private readonly publisher: MetricsPublisher,
        private readonly admission: PublishAdmissionController,
    ) {
    }

    async publish(event: MetricEvent): Promise<void> {
        const release = this.admission.tryAcquire();

        if (!release) {
            throw new PublisherOverloadedError(this.admission.limit);
        }

        try {
            await this.publisher.publish(event);
        } finally {
            release();
        }
    }

    async close(): Promise<void> {
        await this.publisher.close();
    }
}

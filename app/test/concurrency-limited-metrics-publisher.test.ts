import assert from "node:assert/strict";
import {test} from "node:test";
import type {MetricEvent} from "../src/domain/metric-event.js";
import {
    ConcurrencyLimitedMetricsPublisher,
    PublisherOverloadedError,
} from "../src/publisher/concurrency-limited-metrics-publisher.js";
import type {MetricsPublisher} from "../src/publisher/metrics-publisher.js";
import {PublishAdmissionController} from "../src/publisher/publish-admission-controller.js";

const event: MetricEvent = {
    eventId: "550e8400-e29b-41d4-a716-446655440000",
    eventType: "impression",
    timestamp: "2026-08-24T16:00:00Z",
    deviceId: "device-123",
    adId: "ad-456",
};

test("rejects excess work and restores capacity after publishing", async () => {
    let publishCalls = 0;
    let publisherCloseCalls = 0;
    let releaseFirstPublish: (() => void) | undefined;
    let markFirstPublishStarted: (() => void) | undefined;
    const firstPublishStarted = new Promise<void>((resolve) => {
        markFirstPublishStarted = resolve;
    });
    const firstPublishBlocked = new Promise<void>((resolve) => {
        releaseFirstPublish = resolve;
    });
    const publisher: MetricsPublisher = {
        async publish() {
            publishCalls += 1;

            if (publishCalls === 1) {
                markFirstPublishStarted?.();
                await firstPublishBlocked;
            }
        },
        async close() {
            publisherCloseCalls += 1;
        },
    };
    const admission = new PublishAdmissionController(1);
    const limitedPublisher = new ConcurrencyLimitedMetricsPublisher(
        publisher,
        admission,
    );

    const firstPublish = limitedPublisher.publish(event);
    await firstPublishStarted;

    await assert.rejects(
        limitedPublisher.publish(event),
        PublisherOverloadedError,
    );
    assert.equal(admission.inflight, 1);

    releaseFirstPublish?.();
    await firstPublish;
    assert.equal(admission.inflight, 0);

    await limitedPublisher.publish(event);
    assert.equal(publishCalls, 2);

    await limitedPublisher.close();
    assert.equal(publisherCloseCalls, 1);
});

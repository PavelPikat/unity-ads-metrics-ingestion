import assert from "node:assert/strict";
import {test} from "node:test";
import {buildApp} from "../src/app.js";
import {ApplicationState} from "../src/application-state.js";
import type {MetricsPublisher} from "../src/publisher/metrics-publisher.js";
import type {TelemetryLifecycle} from "../src/telemetry/lifecycle.js";

test("reports liveness", async () => {
    const app = buildApp({logger: false});

    try {
        const response = await app.inject({
            method: "GET",
            url: "/health/live",
        });

        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.json(), {status: "ok"});
    } finally {
        await app.close();
    }
});

test("reports readiness", async () => {
    const app = buildApp({logger: false});

    try {
        const response = await app.inject({
            method: "GET",
            url: "/health/ready",
        });

        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.json(), {status: "ok"});
    } finally {
        await app.close();
    }
});

test("reports not ready while the application is draining", async () => {
    const state = new ApplicationState();
    const app = buildApp({logger: false}, {state});

    try {
        await app.ready();
        state.markNotReady();

        const response = await app.inject({
            method: "GET",
            url: "/health/ready",
        });

        assert.equal(response.statusCode, 503);
        assert.deepEqual(response.json(), {status: "not_ready"});
    } finally {
        await app.close();
    }
});

test("updates lifecycle state and closes application resources", async () => {
    const state = new ApplicationState();
    let publisherCloseCalls = 0;
    let telemetryShutdownCalls = 0;
    const publisher: MetricsPublisher = {
        async publish() {
            // Not used in this test.
        },
        async close() {
            publisherCloseCalls += 1;
        },
    };
    const telemetry: TelemetryLifecycle = {
        async shutdown() {
            telemetryShutdownCalls += 1;
        },
    };
    const app = buildApp({logger: false}, {publisher, state, telemetry});

    await app.ready();
    assert.equal(state.isReady, true);

    await app.close();
    assert.equal(state.isReady, false);
    assert.equal(publisherCloseCalls, 1);
    assert.equal(telemetryShutdownCalls, 1);
});

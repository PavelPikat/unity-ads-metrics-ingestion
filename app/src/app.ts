import Fastify, {
    type FastifyInstance,
    type FastifyServerOptions,
} from "fastify";
import {ApplicationState} from "./application-state.js";
import {DEFAULT_MAX_INFLIGHT_PUBLISHES} from "./config.js";
import {ConcurrencyLimitedMetricsPublisher} from "./publisher/concurrency-limited-metrics-publisher.js";
import type {MetricsPublisher} from "./publisher/metrics-publisher.js";
import {NoopMetricsPublisher} from "./publisher/noop-metrics-publisher.js";
import {PublishAdmissionController} from "./publisher/publish-admission-controller.js";
import {healthRoutes} from "./routes/health.js";
import {metricsRoutes} from "./routes/metrics.js";
import type {TelemetryLifecycle} from "./telemetry/lifecycle.js";

export interface AppDependencies {
    admission?: PublishAdmissionController;
    publisher?: MetricsPublisher;
    state?: ApplicationState;
    telemetry?: TelemetryLifecycle;
}

export function buildApp(
    options: FastifyServerOptions = {},
    dependencies: AppDependencies = {},
): FastifyInstance {
    const basePublisher = dependencies.publisher ?? new NoopMetricsPublisher();
    const admission = dependencies.admission
        ?? new PublishAdmissionController(DEFAULT_MAX_INFLIGHT_PUBLISHES);
    const publisher = new ConcurrencyLimitedMetricsPublisher(
        basePublisher,
        admission,
    );
    const state = dependencies.state ?? new ApplicationState();
    const app = Fastify({
        logger: true,
        bodyLimit: 16 * 1024,
        requestTimeout: 30_000,
        ...options,
    });

    app.addHook("onReady", async () => {
        state.markReady();
    });
    app.addHook("onClose", async () => {
        state.markNotReady();
        try {
            await publisher.close();
        } finally {
            if (dependencies.telemetry) {
                try {
                    await dependencies.telemetry.shutdown();
                } catch (error) {
                    app.log.error({err: error}, "OpenTelemetry shutdown failed");
                }
            }
        }
    });

    app.register(healthRoutes, {state});
    app.register(metricsRoutes, {publisher});

    return app;
}

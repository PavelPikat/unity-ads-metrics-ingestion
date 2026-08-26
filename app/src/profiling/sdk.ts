import type {PyroscopeConfig} from "@pyroscope/nodejs";
import type {TelemetryLifecycle} from "../telemetry/lifecycle.js";
import {loadProfilingConfig} from "./config.js";

export interface ProfilingSdk {
    init(config?: PyroscopeConfig): void;
    start(): void;
    stop(): Promise<void>;
}

type ProfilingSdkLoader = () => Promise<ProfilingSdk>;

const loadPyroscope: ProfilingSdkLoader = () => import("@pyroscope/nodejs");

export async function startProfiling(
    environment: NodeJS.ProcessEnv = process.env,
    loadSdk: ProfilingSdkLoader = loadPyroscope,
): Promise<TelemetryLifecycle> {
    const config = loadProfilingConfig(environment);

    if (!config) {
        return {shutdown: async () => undefined};
    }

    const pyroscope = await loadSdk();
    pyroscope.init({
        appName: config.applicationName,
        serverAddress: config.serverAddress,
        wall: {collectCpuTime: true},
    });
    pyroscope.start();

    let shutdownPromise: Promise<void> | undefined;

    return {
        shutdown() {
            shutdownPromise ??= pyroscope.stop();
            return shutdownPromise;
        },
    };
}

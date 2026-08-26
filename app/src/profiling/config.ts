import * as z from "zod";

export const DEFAULT_PROFILING_APPLICATION_NAME =
    "unity-ads-metrics-ingestion";

const profilingEnvironmentSchema = z.object({
    OTEL_SERVICE_NAME: z.string().min(1).optional(),
    PYROSCOPE_APPLICATION_NAME: z.string().min(1).optional(),
    PYROSCOPE_SERVER_ADDRESS: z.url().optional(),
});

export interface ProfilingConfig {
    applicationName: string;
    serverAddress: string;
}

export function loadProfilingConfig(
    environment: NodeJS.ProcessEnv = process.env,
): ProfilingConfig | undefined {
    const parsed = profilingEnvironmentSchema.parse(environment);

    if (!parsed.PYROSCOPE_SERVER_ADDRESS) {
        return undefined;
    }

    return {
        applicationName: parsed.PYROSCOPE_APPLICATION_NAME
            ?? parsed.OTEL_SERVICE_NAME
            ?? DEFAULT_PROFILING_APPLICATION_NAME,
        serverAddress: parsed.PYROSCOPE_SERVER_ADDRESS,
    };
}

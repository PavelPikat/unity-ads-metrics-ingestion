import * as z from "zod";

export const DEFAULT_MAX_INFLIGHT_PUBLISHES = 100;

const environmentSchema = z.object({
    HOST: z.string().min(1).default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    MAX_INFLIGHT_PUBLISHES: z.coerce.number()
        .int()
        .positive()
        .default(DEFAULT_MAX_INFLIGHT_PUBLISHES),
});

export interface AppConfig {
    host: string;
    port: number;
    maxInflightPublishes: number;
}

export function loadConfig(
    environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
    const parsed = environmentSchema.parse(environment);

    return {
        host: parsed.HOST,
        port: parsed.PORT,
        maxInflightPublishes: parsed.MAX_INFLIGHT_PUBLISHES,
    };
}

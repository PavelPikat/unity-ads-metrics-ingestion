import * as z from "zod";

export const metricEventSchema = z.strictObject({
    eventId: z.uuid(),
    eventType: z.enum(["impression", "click", "conversion"]),
    timestamp: z.iso.datetime({offset: true}),
    deviceId: z.string().min(1).max(128),
    adId: z.string().min(1).max(128),
});

export type MetricEvent = z.infer<typeof metricEventSchema>;

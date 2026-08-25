import {
    context,
    isSpanContextValid,
    trace,
    type SpanContext,
} from "@opentelemetry/api";
import type {FastifyServerOptions} from "fastify";

type LoggerConfiguration = Exclude<
    NonNullable<FastifyServerOptions["logger"]>,
    boolean
>;
type LoggerMixin = NonNullable<LoggerConfiguration["mixin"]>;

export function withTraceCorrelation(
    logger: FastifyServerOptions["logger"],
): boolean | LoggerConfiguration {
    if (logger === false) {
        return false;
    }

    const loggerConfiguration = typeof logger === "object" ? logger : {};
    const configuredMixin = loggerConfiguration.mixin;
    const mixin: LoggerMixin = (mergeObject, level, loggerInstance) => ({
        ...configuredMixin?.(mergeObject, level, loggerInstance),
        ...traceCorrelationFields(
            trace.getSpan(context.active())?.spanContext(),
        ),
    });

    return {
        ...loggerConfiguration,
        mixin,
    };
}

export function traceCorrelationFields(
    spanContext: SpanContext | undefined,
): Record<string, string> {
    if (!spanContext || !isSpanContextValid(spanContext)) {
        return {};
    }

    return {
        trace_id: spanContext.traceId,
        span_id: spanContext.spanId,
    };
}

import assert from "node:assert/strict";
import {test} from "node:test";
import {buildApp} from "../src/app.js";

const validEvent = {
    eventId: "550e8400-e29b-41d4-a716-446655440000",
    eventType: "impression",
    timestamp: "2026-08-24T16:00:00Z",
    deviceId: "device-123",
    adId: "ad-456",
};

test("accepts a valid metrics event and logs only event metadata", async () => {
    const logLines: string[] = [];
    const app = buildApp({
        logger: {
            stream: {
                write(line) {
                    logLines.push(line);
                },
            },
        },
    });

    try {
        const response = await app.inject({
            method: "POST",
            url: "/v1/metrics",
            payload: validEvent,
        });

        assert.equal(response.statusCode, 202);

        const acceptedLog = logLines
            .map((line) => JSON.parse(line) as Record<string, unknown>)
            .find((entry) => entry.msg === "Metrics event accepted");

        assert.ok(acceptedLog);
        assert.equal(acceptedLog.eventId, validEvent.eventId);
        assert.equal(acceptedLog.eventType, validEvent.eventType);
        assert.equal("deviceId" in acceptedLog, false);
        assert.equal("adId" in acceptedLog, false);
        assert.equal(logLines.some((line) => line.includes(validEvent.deviceId)), false);
        assert.equal(logLines.some((line) => line.includes(validEvent.adId)), false);
    } finally {
        await app.close();
    }
});

test("rejects an invalid metrics event", async () => {
    const app = buildApp({logger: false});

    try {
        const response = await app.inject({
            method: "POST",
            url: "/v1/metrics",
            payload: {...validEvent, eventId: "not-a-uuid"},
        });

        assert.equal(response.statusCode, 400);
        assert.deepEqual(response.json(), {
            statusCode: 400,
            error: "Bad Request",
            message: "Invalid metrics event",
        });
    } finally {
        await app.close();
    }
});

test("rejects a request body larger than 16 KiB", async () => {
    const app = buildApp({logger: false});

    try {
        const response = await app.inject({
            method: "POST",
            url: "/v1/metrics",
            payload: {...validEvent, deviceId: "x".repeat(16 * 1024)},
        });

        assert.equal(response.statusCode, 413);
        assert.equal(response.json().code, "FST_ERR_CTP_BODY_TOO_LARGE");
    } finally {
        await app.close();
    }
});

test("requires an application/json content type", async () => {
    const app = buildApp({logger: false});

    try {
        const response = await app.inject({
            method: "POST",
            url: "/v1/metrics",
            headers: {"content-type": "text/plain"},
            payload: JSON.stringify(validEvent),
        });

        assert.equal(response.statusCode, 415);
        assert.deepEqual(response.json(), {
            statusCode: 415,
            error: "Unsupported Media Type",
            message: "Content-Type must be application/json",
        });
    } finally {
        await app.close();
    }
});

test("configures request size and receive-time limits", async () => {
    const app = buildApp({logger: false});

    try {
        assert.equal(app.initialConfig.bodyLimit, 16 * 1024);
        assert.equal(app.server.requestTimeout, 30_000);
    } finally {
        await app.close();
    }
});

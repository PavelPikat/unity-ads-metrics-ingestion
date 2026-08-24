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

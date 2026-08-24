export class PublishAdmissionController {
    #inflight = 0;

    constructor(readonly limit: number) {
        if (!Number.isInteger(limit) || limit < 1) {
            throw new Error("Publish concurrency limit must be a positive integer");
        }
    }

    get inflight(): number {
        return this.#inflight;
    }

    tryAcquire(): (() => void) | undefined {
        if (this.#inflight >= this.limit) {
            return undefined;
        }

        this.#inflight += 1;
        let released = false;

        return () => {
            if (released) {
                return;
            }

            released = true;
            this.#inflight -= 1;
        };
    }
}

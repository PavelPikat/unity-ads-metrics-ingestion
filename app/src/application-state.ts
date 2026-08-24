export class ApplicationState {
    #ready = false;

    get isReady(): boolean {
        return this.#ready;
    }

    markReady(): void {
        this.#ready = true;
    }

    markNotReady(): void {
        this.#ready = false;
    }
}

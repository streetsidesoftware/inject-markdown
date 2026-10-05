/**
 * An error in a run's options, not in a processed document.
 * A caller can report it as a usage error rather than a crash.
 */
export class OptionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OptionError';
    }
}

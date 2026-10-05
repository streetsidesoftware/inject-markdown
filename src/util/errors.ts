/**
 * An error in a run's options, as opposed to an error in a processed document, so a caller can
 * report it as a usage error rather than a crash.
 */
export class OptionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OptionError';
    }
}

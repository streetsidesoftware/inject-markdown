/**
 * An error in operator-supplied input (CLI options), as opposed to an error in a processed
 * document. Reported as a plain CLI message instead of an uncaught exception with a stack trace.
 */
export class OptionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OptionError';
    }
}

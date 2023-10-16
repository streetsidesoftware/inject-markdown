import type { BufferEncoding } from '../FileSystemAdapter/FileSystemAdapter.js';

export function toString(content: string | Buffer | Uint8Array, encoding: BufferEncoding): string {
    if (typeof content === 'string') return content;

    if (content instanceof Buffer) {
        return content.toString(encoding);
    }

    return Buffer.from(content).toString(encoding);
}

export function toError(e: unknown): Error {
    if (e && typeof e === 'object') return e as Error;
    if (typeof e === 'string') return new Error(e);
    return new Error('Unknown');
}

import type { Data as VFileData, MessageOptions as VFileMessageOptions } from 'vfile';
import { VFile } from 'vfile';

import type { BufferEncoding } from '../FileSystemAdapter/FileSystemAdapter.js';

export type MessageOptions = VFileMessageOptions['place'];

export interface FileData extends VFileData {
    encoding: BufferEncoding;
    fileUrl: URL;
    cwdUrl?: URL;
    hasInjections?: boolean;
}

export class VFileEx extends VFile {
    readonly fileUrl: URL;
    data: FileData;
    #content: string;

    constructor(value: string, data: FileData) {
        super({ path: data.fileUrl.pathname, value, data });
        this.fileUrl = data.fileUrl;
        this.data = data;
        this.#content = value;
    }

    error(reason: string, place?: MessageOptions): ReturnType<VFile['message']> {
        const msg = this.message(reason, place);
        msg.fatal = true;
        return msg;
    }

    get content(): string {
        return this.#content;
    }
}

export function isVFileEx(file: VFile | VFileEx): file is VFileEx {
    return file instanceof VFileEx;
}

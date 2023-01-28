import { Data as VFileData, VFile } from 'vfile';

import type { BufferEncoding } from '../FileSystemAdapter/FileSystemAdapter.js';

export interface FileData extends VFileData {
    encoding: BufferEncoding;
    fileUrl: URL;
    cwdUrl?: URL;
    hasInjections?: boolean;
}

export interface VFileEx extends VFile {
    data: FileData;
}

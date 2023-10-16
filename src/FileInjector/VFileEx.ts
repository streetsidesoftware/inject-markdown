import { type Data as VFileData, VFile } from 'vfile';

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

export function isVFileEx(file: VFile | VFileEx): file is VFileEx {
    return !!file.data.fileUrl;
}

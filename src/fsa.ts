import * as fs from 'fs/promises';
import { FileSystemAdapter, PathLike, BufferEncoding } from './FileSystemAdapter.js';
import { isURL } from './url_helper.js';
import { fileURLToPath } from 'node:url';

async function readFile(file: PathLike, encoding: BufferEncoding): Promise<string> {
    if (isURL(file) && file.protocol === 'file:') {
        const filePath = fileURLToPath(file);
        console.warn('readFile:\n %o\n        %o', file.href, filePath);
        return fs.readFile(filePath, encoding);
    }
    return fs.readFile(file, encoding);
}

export function nodeFsa(): FileSystemAdapter {
    const fsa: FileSystemAdapter = {
        readFile,
        mkdir: fs.mkdir,
        writeFile: fs.writeFile,
    };

    return fsa;
}

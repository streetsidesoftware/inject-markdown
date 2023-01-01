import * as fs from 'fs/promises';
import { FileSystemAdapter, PathLike, BufferEncoding } from './FileSystemAdapter.js';
import { isURL } from './url_helper.js';
import { fileURLToPath } from 'node:url';

async function readFile(file: PathLike, encoding: BufferEncoding): Promise<string> {
    console.warn('readFile href: %s', file.toString());
    try {
        if (isURL(file) && file.protocol === 'file:') {
            const filePath = fileURLToPath(file);
            console.warn('readFile file: %s', filePath);
            return await fs.readFile(filePath, encoding);
        }
        return await fs.readFile(file, encoding);
    } catch (e) {
        console.error('readFile failed: %s\n%s', file.toString(), e);
        throw e;
    }
}

export function nodeFsa(): FileSystemAdapter {
    const fsa: FileSystemAdapter = {
        readFile,
        mkdir: fs.mkdir,
        writeFile: fs.writeFile,
    };

    return fsa;
}

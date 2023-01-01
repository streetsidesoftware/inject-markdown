import * as fs from 'fs/promises';
import { BufferEncoding, FileSystemAdapter, PathLike } from './FileSystemAdapter.js';
import { isURL } from './url_helper.js';
import fetch from 'node-fetch';

async function readFile(file: PathLike, encoding: BufferEncoding): Promise<string> {
    if (isURL(file)) {
        if (file.protocol === 'file:') {
            return await fs.readFile(file, encoding);
        }
        const response = await fetch(file.href);
        return await response.text();
    }
    return await fs.readFile(file, encoding);
}

export function nodeFsa(): FileSystemAdapter {
    const fsa: FileSystemAdapter = {
        readFile,
        mkdir: fs.mkdir,
        writeFile: fs.writeFile,
    };

    return fsa;
}

import * as fs from 'fs/promises';
import { FileSystemAdapter } from './FileSystemAdapter.js';

export function nodeFsa(): FileSystemAdapter {
    const fsa: FileSystemAdapter = {
        readFile: fs.readFile,
        mkdir: fs.mkdir,
        writeFile: fs.writeFile,
    };

    return fsa;
}

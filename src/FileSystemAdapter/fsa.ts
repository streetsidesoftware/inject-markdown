import * as fs from 'fs/promises';
import { BufferEncoding, FileSystemAdapter, PathLike } from './FileSystemAdapter.js';
import { isURL } from '../util/url_helper.js';
import fetch from 'node-fetch';

async function readFile(file: PathLike, encoding: BufferEncoding): Promise<string> {
    if (isURL(file)) {
        if (file.protocol === 'file:') {
            return await fs.readFile(file, encoding);
        }
        return await fetchUrl(file);
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

async function fetchUrl(url: URL): Promise<string> {
    const response = await fetch(mapUrl(url));
    return await response.text();
}

function mapUrl(url: URL): string {
    let href = url.href;

    // Remap GitHub blobs
    href = href.replace(/^https?:\/\/github.com\/([^/]+\/[^/]+)\/blob\//, 'https://raw.githubusercontent.com/$1/');

    return href;
}

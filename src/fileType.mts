import * as path from 'node:path';

const specialExtensions: Record<string, string | undefined> = {
    '.md': 'markdown',
};

export function fileType(filename: string): string {
    filename = filename.toLowerCase();
    const ext = path.extname(filename);
    if (!ext) {
        if (filename) return '';
    }

    return specialExtensions[ext] || ext.slice(1);
}
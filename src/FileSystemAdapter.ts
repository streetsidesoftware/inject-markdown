export type BufferEncoding = 'utf8';

export type PathLike = string | URL;

export interface FileSystemAdapter {
    readFile(file: PathLike, encoding: BufferEncoding): Promise<string>;
    writeFile(file: PathLike, data: string, encoding: BufferEncoding): Promise<void>;
    mkdir(
        path: PathLike,
        options: {
            recursive: true;
        }
    ): Promise<string | undefined>;
}

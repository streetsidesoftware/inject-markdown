import { VFile } from 'vfile';
import { reporter } from 'vfile-reporter';

export function reportFileErrors(file: VFile): string {
    const hasMessages = file.messages.length > 0;

    return (hasMessages && reporter(file)) || '';
}

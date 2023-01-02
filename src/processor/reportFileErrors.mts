import { VFile } from 'vfile';
import { reporter } from 'vfile-reporter';

export function reportFileErrors(file: VFile): string {
    const hasErrors = file.messages.length > 0;

    return (hasErrors && reporter(file)) || '';
}

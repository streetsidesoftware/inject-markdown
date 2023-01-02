import { reporter } from 'vfile-reporter';
import { VFileEx } from '../FileInjector/VFileEx.js';

export function reportFileErrors(file: VFileEx): string {
    const hasErrors = file.messages.length > 0;

    return (hasErrors && reporter(file)) || '';
}

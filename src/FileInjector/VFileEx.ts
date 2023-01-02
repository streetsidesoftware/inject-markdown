import { VFile } from 'vfile';
import { FileData } from './FileInjector';

export interface VFileEx extends VFile {
    data: FileData;
}

import type { Html } from 'mdast';

import type { FileSystemAdapter, PathLike } from '../FileSystemAdapter/FileSystemAdapter.js';
import { OptionError } from '../util/errors.js';
import type { InjectInfo } from '../util/hash.js';
import type { PlaceholderResolver } from '../util/placeholders.js';
import { parseRelativeUrl } from '../util/url_helper.js';
import {
    layerFromPair,
    readValuesFileLayer,
    resolveInLayers,
    type UnresolvedReason,
    type ValueDeclaration,
    type ValueLayer,
    type ValuesFileEntry,
} from '../util/values.js';
import type { FileInjectorOptions } from './FileInjector.js';

/** One declaration ready to resolve against (ADR-0012): an alias, or the value layer it supplies. */
export type ResolutionEntry = { alias: string; target: string } | { layer: ValueLayer };

/** `via` names the alias target that failed, so the message can name both sides (ADR-0010 point 9). */
export type NameResolution = { value: string } | { unresolved: UnresolvedReason; via?: string | undefined };

/**
 * ADR-0005 point 4's unresolved cases: nothing defines the name, versus every layer that has it
 * holds a branch rather than a leaf — the kind is named so an author can tell a typo from a name
 * that stopped one segment short. ADR-0010 point 9 adds the aliased forms, which name both sides.
 */
export function explainUnresolved(r: NameResolution): string {
    if ('value' in r) return '';
    const via = r.via;
    if (r.unresolved === 'cycle') return `alias cycle through "${via}"`;
    const why =
        r.unresolved === 'object'
            ? 'resolves to an object, not a value'
            : r.unresolved === 'array'
              ? 'resolves to an array, not a value'
              : r.unresolved === 'null'
                ? 'resolves to null, not a value'
                : 'no value source defines it';
    return via === undefined ? why : `aliased to "${via}": ${why}`;
}

/** Run-wide placeholder sources shared by every directive in a run: `--value`/`--values-file`/`--value-alias`/`--allow-env`. */
export interface RunWideValueSources {
    /** CLI declarations, newest first; values files are read once per run. */
    entries: ResolutionEntry[];
    /** Environment variable names allow-listed via `--allow-env`. */
    allowEnvSet: ReadonlySet<string>;
}

/**
 * Turn declarations (written oldest first) into resolution entries, newest first, per ADR-0012
 * point 1. A values file that fails to read contributes nothing; `readFile` reports why.
 */
export async function buildResolutionEntries(
    decls: readonly ValueDeclaration[],
    readFile: (entry: ValuesFileEntry) => Promise<ValueLayer | undefined>,
): Promise<ResolutionEntry[]> {
    const entries: ResolutionEntry[] = [];
    // Read in written order so errors are reported in the order the author listed the files.
    for (const decl of decls) {
        switch (decl.kind) {
            case 'value':
                entries.push({ layer: layerFromPair(decl.name, decl.value) });
                break;
            case 'alias':
                entries.push({ alias: decl.name, target: decl.target });
                break;
            case 'values-file': {
                const layer = await readFile(decl.entry);
                if (layer) entries.push({ layer });
                break;
            }
        }
    }
    return entries.reverse();
}

/**
 * Resolve the run-wide placeholder sources from CLI-level options, reading any `--values-file`
 * entries relative to `cwd`. `options` is constant for a run, so a caller processing many files
 * should compute this once and reuse it rather than calling it per file.
 */
export async function resolveRunWideValueSources(
    fs: FileSystemAdapter,
    options: Pick<FileInjectorOptions, 'valueDeclarations' | 'allowEnv'>,
    cwd: URL,
): Promise<RunWideValueSources> {
    const entries = await buildResolutionEntries(options.valueDeclarations ?? [], (entry) =>
        readValuesFileLayer(
            fs,
            entry,
            (p) => Promise.resolve(parseRelativeUrl(p).toUrl(cwd)),
            (message) => {
                throw new OptionError(message);
            },
        ),
    );
    return { entries, allowEnvSet: new Set(options.allowEnv ?? []) };
}

/**
 * Resolve one placeholder name. The `env.` namespace is reserved rather than layered
 * (ADR-0003 point 4): it is answered before any value layer is consulted, so `{@ env.X @}`
 * always means the OS environment and a value source defining a top-level `env` key stays
 * unreachable.
 */
export function resolveValueName(
    entries: readonly ResolutionEntry[],
    name: string,
    allowEnvSet: ReadonlySet<string>,
    seen?: Set<string>,
): NameResolution {
    if (name === 'env' || name.startsWith('env.')) {
        const segments = name.split('.');
        if (segments.length !== 2) return { unresolved: 'undefined' };
        const envName = segments[1];
        if (!allowEnvSet.has(envName)) return { unresolved: 'undefined' };
        const v = process.env[envName];
        return v === undefined ? { unresolved: 'undefined' } : { value: v };
    }
    // A non-scalar never ends the search (ADR-0008 point 3), so the reason a newer layer gave
    // is carried down and only reported if no older entry produces a scalar.
    let blocked: UnresolvedReason | undefined;
    for (const entry of entries) {
        if ('alias' in entry) {
            if (entry.alias !== name) continue;
            // The newest alias decides the name (ADR-0012 point 5), so its target's failure is
            // the answer -- resolution does not fall back to older entries for the name itself.
            const target = entry.target;
            if (seen?.has(name)) return { unresolved: 'cycle', via: target };
            const r = resolveValueName(entries, target, allowEnvSet, new Set(seen).add(name));
            return 'value' in r ? r : { unresolved: r.unresolved, via: r.via ?? target };
        }
        const r = resolveInLayers([entry.layer], name);
        if ('value' in r) return r;
        if (r.unresolved !== 'undefined') blocked ??= r.unresolved;
    }
    return { unresolved: blocked ?? 'undefined' };
}

/**
 * A directive's resolution entries, directive declarations first (they are newer than every CLI
 * one, ADR-0012 point 3). Directive `values-file=` paths resolve relative to the containing
 * document, per ADR-0002 point 2.
 */
export async function buildDirectiveEntries(
    fs: FileSystemAdapter,
    decls: readonly ValueDeclaration[],
    fileUrl: URL,
    resolveWithinInjectionRoot: (target: URL) => Promise<URL>,
    onError: (message: string) => void,
    runWide: RunWideValueSources,
): Promise<ResolutionEntry[]> {
    // Return the path the boundary approved, so the read can't follow a symlink swapped in after
    // the check (time-of-check/time-of-use) -- the same guard directive file references are read through.
    const resolvePath = (p: string): Promise<PathLike> =>
        resolveWithinInjectionRoot(parseRelativeUrl(p).toUrl(fileUrl));
    const directive = await buildResolutionEntries(decls, (entry) =>
        readValuesFileLayer(fs, entry, resolvePath, onError),
    );
    return [...directive, ...runWide.entries];
}

/** Dependencies {@link applySubstitution} needs beyond the directive's own parsed `info`. */
export interface ApplySubstitutionDeps {
    fs: FileSystemAdapter;
    /** The containing document's URL; directive-level `values-file=` paths resolve relative to it. */
    fileUrl: URL;
    strictVars: boolean | undefined;
    runWide: RunWideValueSources;
    /** The injection-root boundary check directive file references are also read through. */
    resolveWithinInjectionRoot: (target: URL) => Promise<URL>;
    reportError: (message: string, position: Html['position']) => void;
    reportMessage: (message: string, position: Html['position']) => void;
}

/**
 * Resolve a directive's placeholder value sources ({@link InjectInfo.valueDecls}) and
 * substitute placeholders in its content via `apply`, reporting unresolved names once per
 * unique name (warning, or a directive error under `--strict-vars`). A directive with none of
 * `values=`/`value=`/`values-file=`/`value-alias=`/`#vars` does no scanning at all, per ADR-0002 point 4.
 */
export async function applySubstitution(
    info: InjectInfo,
    directiveNode: Html,
    deps: ApplySubstitutionDeps,
    apply: (resolve: PlaceholderResolver, onUnresolved: (name: string) => void) => void,
): Promise<void> {
    const optedIn = info.valueDecls !== undefined || info.valueErrors !== undefined || info.vars === true;
    if (!optedIn) return;
    for (const message of info.valueErrors ?? []) deps.reportError(message, directiveNode.position);
    const entries = await buildDirectiveEntries(
        deps.fs,
        info.valueDecls ?? [],
        deps.fileUrl,
        deps.resolveWithinInjectionRoot,
        (message) => deps.reportError(message, directiveNode.position),
        deps.runWide,
    );
    const unresolved = new Set<string>();
    apply(
        (name) => {
            const r = resolveValueName(entries, name, deps.runWide.allowEnvSet);
            return 'value' in r ? r.value : undefined;
        },
        (name) => unresolved.add(name),
    );
    for (const name of unresolved) {
        // Re-resolve only the names that failed, to say which of ADR-0005 point 4's two cases it is.
        const r = resolveValueName(entries, name, deps.runWide.allowEnvSet);
        const message = `Unresolved placeholder "{@ ${name} @}": ${explainUnresolved(r)}`;
        if (deps.strictVars) {
            deps.reportError(message, directiveNode.position);
        } else {
            deps.reportMessage(message, directiveNode.position);
        }
    }
}

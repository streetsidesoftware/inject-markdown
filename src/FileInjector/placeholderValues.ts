import type { Html } from 'mdast';

import type { FileSystemAdapter } from '../FileSystemAdapter/FileSystemAdapter.js';
import { OptionError } from '../util/errors.js';
import type { InjectInfo } from '../util/hash.js';
import type { PlaceholderResolver } from '../util/placeholders.js';
import { parseRelativeUrl } from '../util/url_helper.js';
import {
    buildValuesFileLayers,
    layersFromFlatMap,
    parseValuesFileEntry,
    resolveInLayers,
    type UnresolvedReason,
    type ValueLayer,
} from '../util/values.js';
import type { FileInjectorOptions } from './FileInjector.js';

/** One rank of ADR-0010 point 3's order: either an alias table or a group of value layers. */
export interface ResolutionTier {
    aliases?: ReadonlyMap<string, string> | undefined;
    layers?: ValueLayer[] | undefined;
}

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

function toFlatMap(value: Record<string, string> | undefined): Map<string, string> | undefined {
    if (!value) return undefined;
    return new Map(Object.entries(value));
}

/** Run-wide placeholder sources shared by every directive in a run: `--value`/`--values-file`/`--value-alias`/`--allow-env`. */
export interface RunWideValueSources {
    /** Run-wide `--value-alias` entries, as a name -> target lookup. */
    aliasMap: ReadonlyMap<string, string>;
    /** Run-wide `--value` entries, one layer per flag, highest precedence first. */
    cliValueLayers: ValueLayer[];
    /** Run-wide `--values-file` entries, one layer per entry, read once per run. */
    cliValuesFileLayers: ValueLayer[];
    /** Environment variable names allow-listed via `--allow-env`. */
    allowEnvSet: ReadonlySet<string>;
}

/**
 * Resolve the run-wide placeholder sources from CLI-level options, reading any `--values-file`
 * entries relative to `cwd`. `options` is constant for a run, so a caller processing many files
 * should compute this once and reuse it rather than calling it per file.
 */
export async function resolveRunWideValueSources(
    fs: FileSystemAdapter,
    options: Pick<FileInjectorOptions, 'value' | 'valuesFile' | 'allowEnv' | 'valueAlias'>,
    cwd: URL,
): Promise<RunWideValueSources> {
    const rawEntries = options.valuesFile;
    const cliValuesFileLayers = rawEntries?.length
        ? await buildValuesFileLayers(
              fs,
              rawEntries.map(parseValuesFileEntry),
              (p) => Promise.resolve(parseRelativeUrl(p).toUrl(cwd)),
              (message) => {
                  throw new OptionError(message);
              },
          )
        : [];
    return {
        aliasMap: toFlatMap(options.valueAlias) ?? new Map(),
        cliValueLayers: layersFromFlatMap(toFlatMap(options.value)),
        cliValuesFileLayers,
        allowEnvSet: new Set(options.allowEnv ?? []),
    };
}

/**
 * A directive's value layers in precedence order, per ADR-0004 and ADR-0008 point 2 — each
 * group already ordered last-listed first.
 */
export function buildValueTiers(
    info: InjectInfo,
    directiveValuesFileLayers: ValueLayer[],
    runWide: RunWideValueSources,
): ResolutionTier[] {
    return [
        { aliases: info.valueAlias },
        { layers: layersFromFlatMap(info.values) },
        { layers: directiveValuesFileLayers },
        { aliases: runWide.aliasMap },
        { layers: runWide.cliValueLayers },
        { layers: runWide.cliValuesFileLayers },
    ];
}

/**
 * Resolve one placeholder name. The `env.` namespace is reserved rather than layered
 * (ADR-0003 point 4): it is answered before any value layer is consulted, so `{@ env.X @}`
 * always means the OS environment and a value source defining a top-level `env` key stays
 * unreachable.
 */
export function resolveValueName(
    tiers: ResolutionTier[],
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
    // A non-scalar never ends the search (ADR-0008 point 3), so the reason a higher tier gave
    // is carried down and only reported if no tier below it produces a scalar.
    let blocked: UnresolvedReason | undefined;
    for (const tier of tiers) {
        if (tier.aliases) {
            const target = tier.aliases.get(name);
            if (target === undefined) continue;
            // An alias outranks its own tier's values (ADR-0010 point 3), so its target's
            // failure is the answer -- resolution does not fall back to the name itself.
            if (seen?.has(name)) return { unresolved: 'cycle', via: target };
            const r = resolveValueName(tiers, target, allowEnvSet, new Set(seen).add(name));
            return 'value' in r ? r : { unresolved: r.unresolved, via: r.via ?? target };
        }
        const r = resolveInLayers(tier.layers ?? [], name);
        if ('value' in r) return r;
        if (r.unresolved !== 'undefined') blocked ??= r.unresolved;
    }
    return { unresolved: blocked ?? 'undefined' };
}

/** Directive `values-file=` paths resolve relative to the containing document, per ADR-0002 point 2. */
export async function resolveDirectiveValuesFileLayers(
    fs: FileSystemAdapter,
    entries: NonNullable<InjectInfo['valuesFile']>,
    fileUrl: URL,
    resolveWithinInjectionRoot: (target: URL) => Promise<URL>,
    onError: (message: string) => void,
): Promise<ValueLayer[]> {
    return buildValuesFileLayers(
        fs,
        entries,
        // Return the path the boundary approved, so the read can't follow a symlink
        // swapped in after the check (time-of-check/time-of-use) -- the same guard
        // directive file references are read through.
        (p) => resolveWithinInjectionRoot(parseRelativeUrl(p).toUrl(fileUrl)),
        onError,
    );
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
 * Resolve a directive's placeholder value sources ({@link InjectInfo.values}/`valuesFile`) and
 * substitute placeholders in its content via `apply`, reporting unresolved names once per
 * unique name (warning, or a directive error under `--strict-vars`). A directive with none of
 * `values=`/`values-file=`/`#vars` does no scanning at all, per ADR-0002 point 4.
 */
export async function applySubstitution(
    info: InjectInfo,
    directiveNode: Html,
    deps: ApplySubstitutionDeps,
    apply: (resolve: PlaceholderResolver, onUnresolved: (name: string) => void) => void,
): Promise<void> {
    const optedIn =
        info.values !== undefined ||
        info.valuesFile !== undefined ||
        info.valueAlias !== undefined ||
        info.vars === true;
    if (!optedIn) return;
    const directiveValuesFileLayers = info.valuesFile
        ? await resolveDirectiveValuesFileLayers(
              deps.fs,
              info.valuesFile,
              deps.fileUrl,
              deps.resolveWithinInjectionRoot,
              (message) => deps.reportError(message, directiveNode.position),
          )
        : [];
    const tiers = buildValueTiers(info, directiveValuesFileLayers, deps.runWide);
    const unresolved = new Set<string>();
    apply(
        (name) => {
            const r = resolveValueName(tiers, name, deps.runWide.allowEnvSet);
            return 'value' in r ? r.value : undefined;
        },
        (name) => unresolved.add(name),
    );
    for (const name of unresolved) {
        // Re-resolve only the names that failed, to say which of ADR-0005 point 4's two cases it is.
        const r = resolveValueName(tiers, name, deps.runWide.allowEnvSet);
        const message = `Unresolved placeholder "{@ ${name} @}": ${explainUnresolved(r)}`;
        if (deps.strictVars) {
            deps.reportError(message, directiveNode.position);
        } else {
            deps.reportMessage(message, directiveNode.position);
        }
    }
}

# Deny access

## Why

The [injection root](../../guide/injection-root.md) stops a directive reading outside the tree. It says nothing about what sits inside, and CI routinely puts secrets there: an `.npmrc` with a publish token, a `.env` from a setup step, a `kubeconfig`, a `.git/config` with an authenticated remote.

A directive is text in a Markdown file, so anyone who can open a pull request can add one that reads these into the generated document.

Running with `--cwd docs/` narrows the exposure, but only when the docs live in their own subtree. It does nothing for a secret inside that subtree.

## Design

A repeatable `--deny-access <glob>` option, with a matching `denyAccess?: string[]` field on `FileInjectorOptions`. A local directive reference whose target matches any pattern is refused.

```sh
inject-markdown --deny-access '**/*.env' --deny-access '.npmrc' README.md
```

With this, `<!--- @@inject: .npmrc --->` fails with an `Access denied` error that names the pattern `.npmrc`.

The tool doesn't decide what's sensitive. The operator knows their own tree, and the tool doesn't. There are no patterns unless the operator supplies them.

Turned down:

- A denylist the tool ships, as a default or hard-coded: it's never complete, and it would break anyone legitimately injecting a dotfile.
- Guidance only (`--cwd docs/`): it depends on a repository layout, and offers nothing for a secret inside the docs subtree.

### Scope

- **Directive reads only.** The check runs where the injection root is enforced. A denied `.md` file can still be processed as a document. It just can't be injected into another one.
- **Local files only.** A glob describes paths. Remote destinations are covered by [remote guardrails](../remote-guardrails/README.md).

Turned down:

- Also excluding files from discovery: one flag would grant two different things. An operator can narrow the glob of files they pass instead.

### Precedence

A deny match always wins. It refuses regardless of `--allow-outside-root`, and regardless of argument order. So the deny patterns alone answer whether a path is reachable, which is what an audit needs.

Turned down:

- `.gitignore`-style ordered allow and deny, to re-open a subpath: reachability would depend on argument order. For a security control, that matters more than expressiveness.

### What a pattern matches

- **A pattern without a leading `**/`** matches the target's path relative to the injection root. `.env*` denies a `.env` at the root of the tree, and `internal/**` denies that subtree.
- **A pattern starting with `**/`** matches the target's absolute path, so it applies everywhere. `**/*.env` denies every `.env` the tool could reach, including inside a directory allowed by `--allow-outside-root`.
- **Patterns match dotfiles.** Standard globs skip a leading dot unless asked, and `.env` is the motivating case.
- **Both resolved forms are matched**: the path as written, resolved against its document, and the real path after symbolic links. A match on either denies. Matching only the written path would let `docs/notes.md` linking to `../.env` slip past `.env*`. Matching only the real path would make the verdict depend on the file existing.
- **Separators are normalized to `/`** before matching, so a pattern behaves the same on Windows.

The two matching bases are a small surprise that the user docs have to explain.

### Reporting

A denial is reported like an injection root denial: a fatal directive error worded `Access denied`, naming the pattern that matched. A glob match reveals nothing that the pattern's author doesn't already know, so it can say why. See the design principle [a denial says as much as it safely can](../../design-principles.md#a-denial-says-as-much-as-it-safely-can).

### Building it

- Glob matching needs a direct dependency, such as `picomatch`, rather than the one `tinyglobby` brings in.
- The option protects nobody who doesn't configure it. `SECURITY.md` should say so plainly, and recommend it alongside `--cwd`.

## Open questions

- Windows path normalization should share one answer with the template-variables handling of drive letters, rather than growing a second one.

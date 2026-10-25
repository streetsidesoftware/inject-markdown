# WIP: Designs index

## Why

Design docs hold facts that are also written somewhere else: a design's status, name, description, and user-docs link. Authors keep every copy in sync by hand, as `docs/feature-design.md` and the `feature-design` skill tell them to. Nothing checks the copies, so they drift. Then a reader gets a different answer depending on which file they open: the index, the design, or another design that mentions it.

## Design

Every fact about a design is written once, in the design. The index, `docs/designs/README.md`, is generated from the design folders, and autofix keeps it current on every pull request. An author edits only the design and never runs the generator.

The index is one table. Each row links a design by its folder name and shows the design's heading as written:

```markdown
| Design                                             | Title                  |
| -------------------------------------------------- | ---------------------- |
| [`deny-access`](deny-access/README.md)             | Deny access            |
| [`remote-guardrails`](remote-guardrails/README.md) | WIP: Remote guardrails |
```

Settling a design means dropping `WIP:` from its heading. The index follows on the next autofix run.

### What the index shows

- **The folder name** is the design's slug and its link.
- **The heading text** is the first line of the design that starts with `# `, without the `# `. A regular expression search of the file finds it. A design without one gets an empty Title cell, so the row still links it and the blank stands out in review. It includes `WIP:` when the design isn't settled. Nothing parses the `WIP:` prefix, and no status is stored anywhere else.

Turned down:

- **A separate status field (`wip`, `settled`, `built`).** It's a second copy of what the heading already says.
- **A separate name.** It's the same text as the heading.
- **A description column.** It would be a hand-written line in each design that only the index needs. The folder name and the title are enough to find a design.
- **Planned and Built tables, with a user-docs link.** Whether a feature has shipped is a fact about the code and the user docs, not the design. Recording it in the design would be another copy to keep in sync. A design that wants to point at its user docs links them in its own text.

### The data and the generator

The generator writes one file, `docs/designs/static/designs.json`: an array with one object per design, sorted by folder name. Its keys are the table's columns.

```json
[
  { "Design": "[`deny-access`](../deny-access/README.md)", "Title": "Deny access" },
  { "Design": "[`remote-guardrails`](../remote-guardrails/README.md)", "Title": "WIP: Remote guardrails" }
]
```

The index injects it as a table:

```markdown
<!--- @@inject-table: static/designs.json#markdown --->
```

- With `#markdown`, each cell is parsed as Markdown, and its links are rebased from the JSON file to the index. So the JSON's links resolve from the JSON's own location, and the index's links resolve from the index.
- The generator builds the link cell with the Markdown builders, `link(inlineCode(slug), url)`, so a slug or title can't break the cell. It's the builders' first in-repo user.
- A design is a folder under `docs/designs/` that holds a `README.md`. `static/` holds no `README.md`, so it isn't taken for a design. The name `static` is reserved.
- The index's intro text stays hand-written. Only the injected table is generated.

Turned down:

- **A per-design `info.json`.** `@@inject-table:` reads one file, so per-design files would need a merge step, and nothing else reads them. A generated copy of the heading in each folder would also be one more file to commit.
- **Writing the table into the index directly, with no data file.** That needs a table builder, which comes in round two of the builders, or pipe-table text written without the builders' escaping.

### When it runs

`pnpm build:designs` runs `scripts/build-designs.mts` to write `static/designs.json`, then `./bin.mjs docs/designs/README.md`, then Prettier on both files.

- The autofix job runs it as its own step, after `pnpm build`, since it uses the built builders. Autofix commits the result on the pull request.
- `pnpm build:readme` calls it too, for anyone who regenerates the docs locally.

The autofix action sees only files changed in its own job, and its docs advise one job with one call to the action. A separate workflow would need its own job, and so a second action call. Running it as a step in the existing job avoids that. Generating the index isn't style, so it isn't part of `lint:fix`.

### Writing rule

A design doesn't state another feature's build status in its prose. It links to that feature's design or user docs instead. For example, `table-columns` says that `header-rows` and JSON sources "are built and documented in the README". That sentence goes stale when either changes. A link to the table guide doesn't.

This rule goes in `docs/feature-design.md`.

### What changes

- `docs/designs/README.md`: its two hand-written tables are replaced by the injected table.
- `docs/feature-design.md` and `.claude/skills/feature-design/SKILL.md`: drop every instruction to edit the index, and add the writing rule. Settling a design is dropping `WIP:` from its heading. When a feature is built, its design is updated where building changed it, and nothing else.
- `table-columns/README.md:13` is reworded under the writing rule.
- `template-variables/README.md` keeps its user-guide link, in its own text.

The change is `docs:` for the documents and `chore:` or `ci:` for the script and the workflow step. Users of inject-markdown see no change.

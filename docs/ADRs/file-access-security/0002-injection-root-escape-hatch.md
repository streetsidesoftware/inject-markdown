# ADR-0002: Injection-root escape hatch (`--allow-outside-root`)

**Status:** Proposed
**Date:** 2026-09-21
**Deciders:** Jason Dent

## Context

[ADR-0001](0001-injection-root-boundary.md) makes the injection root (`cwd`) a hard boundary for local directive-file references. Some legitimate setups need to reach outside it — e.g. a monorepo doc at `packages/docs/README.md` injecting a code sample from a sibling `packages/shared/src/example.ts` that sits outside whatever `cwd` the tool was invoked with. Without an escape hatch, ADR-0001's boundary blocks these alongside the attacks it's meant to stop.

## Decision

Add a repeatable CLI option `--allow-outside-root <dir>` (and a matching `FileInjectorOptions.allowOutsideRoot?: string[]`, per this repo's convention of mirroring every CLI option into the `Options`/`FileInjectorOptions` interfaces) naming specific additional directories a directive may resolve into, on top of the injection root. Each value is resolved to an absolute path and realpath'd, the same as the root itself, at startup; a directive's resolved, realpath'd target is allowed if it falls inside the injection root _or_ inside any listed extra directory.

## Options Considered

- **Single boolean `--allow-outside-root`** (disable the check entirely) — rejected: reopens the exact exposure ADR-0001 closes for the whole run, just to satisfy one legitimate cross-package reference; a targeted allowlist keeps the boundary meaningful everywhere else in the same run.
- **A single `--root <dir>` override instead of a list** — rejected: widening one root to a common ancestor (e.g. the monorepo's top) would typically re-admit sibling packages' `node_modules`, `.env` files, etc. too — coarser than naming only the specific directories actually needed.

## Consequences

- `app.mts` needs a new repeatable Commander option (accumulating into an array, matching Commander's pattern for repeatable options), threaded through to `FileInjectorOptions.allowOutsideRoot`.
- Documented in `README.md` next to the injection-root boundary itself, with the monorepo example, so it doesn't read as a way to blanket-disable the protection.

# ADR-0005: Documented threat model and safe-usage guidance

**Status:** Proposed
**Date:** 2026-09-22
**Deciders:** Jason Dent

## Context

Four ADRs in this group and the three in [file-access-security/](../file-access-security/) each close something specific. None of them says what `inject-markdown` does and does not defend against, which is the question someone evaluating it for a continuous-integration pipeline actually has. Two exposures in particular are deliberately *not* closed in code, and a reader has no way to learn that from the ADRs, which are organized by decision rather than by risk:

- **Secrets inside the injection root.** The boundary is the tree; anything a setup step writes into it stays readable by a directive. [ADR-0004](0004-deny-access-globs.md) gives the operator a way to deny specific paths, but it is opt-in and protects nobody who does not configure it.
- **Output poisoning.** Injected content is spliced verbatim and Markdown permits raw HTML, so content pulled from a compromised or typo-squatted remote — or from a file an attacker controls — carries whatever markup it likes into the generated document. Rendered to a site, that is stored cross-site scripting.

`SECURITY.md` currently holds a reporting address and nothing else.

## Decision

Expand `SECURITY.md` with a threat model and safe-usage section, and link to it from the Injection Root section of `content/README.md` (which regenerates into `README.md`). The ADRs stay the record of *why* each decision was made; `SECURITY.md` becomes the single page describing what is and is not defended, for someone who will never open `docs/ADRs/`.

It states the threat model the tool is built against: a directive is text in a Markdown file, so anyone who can open a pull request touching a processed document can supply one, and the machine running the tool is usually continuous integration holding real credentials. It then covers what is defended — the injection root and its escape hatch, the discovery boundary, remote destination policy and limits, bounded parsing — and, in the same voice and at the same length, what is not:

**Secrets inside the injection root are readable.** Recommend pointing `--cwd` at the documentation subtree rather than the repository root, and `--deny-access` for paths that must never be read. Say plainly that neither is on by default.

**Injected content is never sanitized, by design.** The tool splices what it is given; deciding what is safe to publish belongs to whatever renders the output. Anyone rendering generated documentation to a site must sanitize at render time, exactly as they would for any other user-supplied Markdown. Stripping HTML by default would break legitimate documentation — raw HTML in Markdown is common, and this project's own content uses it — and an opt-in stripping option would raise the question of precisely what it strips without removing the need to sanitize downstream.

**Remote content is not pinned.** A remote reference tracks whatever the URL serves today; the `github.com/blob` → `raw.githubusercontent.com` rewrite follows a branch unless the URL names a commit. Recommend pinning to an immutable revision, as this project's own README does.

**A DNS rebinding window remains** on remote fetches, per [ADR-0003](0003-remote-reference-guardrails.md).

## Options Considered

- **A section in `content/README.md`** instead — rejected: highest visibility, but the README is already long and this is operator guidance rather than usage. A pointer from the Injection Root section gets the discoverability without the bulk.
- **Leaving it in the ADRs** — rejected: accurate for anyone reading `docs/ADRs/`, but nobody evaluating the tool for a pipeline will find it there, and the ADRs are indexed by decision rather than by risk.
- **Stripping raw HTML from injected content by default**, with an opt-out — rejected, as above: it breaks legitimate documentation, and it would not remove the need to sanitize at render time, so it trades real breakage for a partial guarantee.
- **An opt-in HTML-stripping option** — rejected for now: a lever the operator could reach for, but it invites treating the output as sanitized when the real fix is at the rendering boundary. Worth revisiting if a concrete case appears.

## Consequences

- Someone evaluating the tool can find, in one place, both the guarantees and the gaps, without reading eight ADRs.
- Writing the non-goals down makes them harder to quietly erode later, and gives a reviewer something to point at when a future change would widen one.
- `SECURITY.md` becomes a file that has to be kept current. A decision that changes what is defended now has a second place to update, and the ADR describing it should say so.
- The guidance recommends configuration (`--cwd`, `--deny-access`, pinned URLs) that the tool does not apply by default. That is the honest description of the current posture rather than a gap in the document.

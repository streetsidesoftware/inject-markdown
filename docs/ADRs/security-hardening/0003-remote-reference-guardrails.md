# ADR-0003: Guardrails for remote references

**Status:** Proposed
**Date:** 2026-09-22
**Deciders:** Jason Dent

## Context

[file-access-security/ADR-0001](../file-access-security/0001-injection-root-boundary.md) bounded local reads and explicitly scoped remote fetches out. Those fetches are still unconstrained. `fetchUrl` in [fsa.ts](../../../src/FileSystemAdapter/fsa.ts) is the whole of it:

```ts
async function fetchUrl(url: URL): Promise<string> {
  const response = await fetch(mapUrl(url));
  return await response.text();
}
```

No timeout, no cap on the response body, no policy on where the request goes, and `fetch` follows redirects automatically. A directive is attacker-supplied text under the same threat model — `<!--- @@inject: http://169.254.169.254/latest/meta-data/iam/security-credentials/ --->` in a pull request pulls the runner's cloud credentials into the generated document, and an internal service on a private range is equally reachable. Placing the destination check on the literal URL alone would not hold: an ordinary public host can redirect into those ranges.

This sits in the same class as the disclosure ADR-0001 closed — secrets reaching generated output — and is arguably worse, because it reaches past the machine into the network around it.

Remote injection is not incidental. It is a documented feature, and this project's own `README.md` uses it against a commit-pinned GitHub URL. Whatever is decided has to keep that working.

## Decision

Remote references stay enabled by default. `fetchUrl` gains three guardrails.

### Destination policy

Before each request, resolve the host and refuse the fetch if any resolved address is loopback, link-local (`127.0.0.0/8`, `::1`, `169.254.0.0/16`, `fe80::/10`), or private (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7`). A literal IP in the URL is checked directly. This covers cloud metadata endpoints and internal services under one rule rather than a list of known metadata addresses.

The check runs on **every hop**. Redirects are therefore followed manually (`redirect: 'manual'`) rather than by `fetch`, re-applying the policy to each `Location` before following it, up to a bounded hop count.

`--allow-remote-host <host>` (repeatable, with a matching `FileInjectorOptions` entry per this repo's convention) exempts a named host from the address check, for an internal documentation server that is a legitimate source. It mirrors `--allow-outside-root` and `--allow-env`, which is already this repo's shape for a narrow grant. A redirect hop to any host not itself allow-listed is still refused.

### Limits

A 30 second overall timeout and a 10 MB cap on the response body, as fixed constants. Both are generous for a documentation build, and both surface as an ordinary read failure. Neither is configurable — a flag for each would be more surface than the problem warrants, and the values can be revisited if a real case needs it.

### Reporting

A refusal is explicit on stderr — naming the policy and `--allow-remote-host` — and generic in the error comment written into the document.

This split is deliberate, and it is a different answer from the one [file-access-security/ADR-0001](../file-access-security/0001-injection-root-boundary.md) reaches for local references. There, the check could be reordered so its verdict never depended on the target existing, and the denial could then say everything. Here it cannot: deciding the policy _requires_ resolving the name, so any explicit refusal reveals that the name resolved and that it was internal. Someone who can add a directive to a CI-built pull request could otherwise map the runner's network one hostname per directive. The operator running the tool already knows their own network and needs the diagnosis; the document is the artifact the pull-request author reads back, so it carries the same generic failure as any other unreachable URL.

This is the group's one exception to the denial-reporting rule, which [ADR-0005](0005-threat-model-and-safe-usage.md) states in full — including the assumption it depends on, that the pull-request author does not read the build log.

## Options Considered

- **Off by default, behind `--allow-remote`** — rejected: the strongest posture, and it mirrors the allowlist pattern well, but it breaks a documented headline feature that this project's own README depends on, stacked on top of the 6.0.0 break already shipped. The guardrails close the concrete exposure without that cost.
- **Refuse only known metadata addresses** (`169.254.169.254` and cloud equivalents) — rejected: narrow enough to break nobody, but it leaves every internal service on a private range reachable, and it turns into a list that needs maintaining as providers add endpoints.
- **No destination policy, relying on the timeout and documentation** — rejected under this group's posture: the metadata case is the specific, well-known attack, and refusing private ranges is a fixed rule rather than a judgment call.
- **A blanket `--allow-private-network`** instead of a host-scoped flag — rejected: simpler, but grants the whole private network when the user needs one host.
- **Pin the verified address and connect to it directly** to close the DNS rebinding window — rejected for now: correct, but it means a custom agent lookup, preserving the `Host` header, and interacting with TLS SNI and the manual redirect loop. See Consequences.
- **Explicit refusal in the document as well** — rejected: it hands the pull-request author the internal-DNS oracle described above. The operator loses nothing, because stderr still carries the reason.

## Consequences

- The cloud-metadata and internal-service cases are closed by default, including via redirect, without any configuration.
- An unreachable or slow host now fails in at most 30 seconds instead of hanging the build.
- **A DNS rebinding window remains.** The name is resolved for the check and resolved again by the connection, so a name under attacker control with a very short TTL could answer public for the first and private for the second. Closing it requires connecting to the verified address, which is the rejected option above. Attacking it needs attacker-controlled DNS and buys a request to a host the tool would otherwise refuse, so it is recorded rather than fixed.
- `fetchUrl` grows from two lines to a manual redirect loop with address checks — the largest single piece of implementation in this group, and the one most worth testing against a local server rather than a mock.
- A user injecting from a private host must name it with `--allow-remote-host`; until they do, the failure reads generically in the document, and the reason appears only on the console of whoever ran the tool.
- The existing `mapUrl` GitHub-blob rewrite is unchanged and runs before the policy, so the rewritten `raw.githubusercontent.com` host is the one checked.

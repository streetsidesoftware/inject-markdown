# Remote guardrails

## Why

A directive is text in a Markdown file, so anyone who can open a pull request that touches a processed document can add one. The tool often runs in CI, on a machine with real credentials and a private network around it.

The [injection root](../../guide/injection-root.md) bounds local reads. Remote fetches have no bounds at all: no timeout, no size cap, no rule on where a request may go, and `fetch` follows redirects on its own. So this directive in a pull request copies the runner's cloud credentials into the generated document:

```markdown
<!--- @@inject: http://169.254.169.254/latest/meta-data/iam/security-credentials/ --->
```

An internal service on a private address is just as reachable. Checking only the URL as written wouldn't hold, because a public host can redirect into those ranges.

Remote injection is a documented feature, and this project's own README injects from a commit-pinned GitHub URL. Whatever ships has to keep that working.

## Design

Remote references stay on by default. The fetch gains a destination policy, limits, and split reporting.

### Destination policy

Before each request, the host is resolved. The fetch is refused if any resolved address is:

- loopback: `127.0.0.0/8`, `::1`
- link-local: `169.254.0.0/16`, `fe80::/10`
- private: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7`

A literal IP in the URL is checked directly. One rule covers cloud metadata endpoints and internal services alike.

- **Every hop is checked.** Redirects are followed by hand, up to a fixed hop count, and the policy is applied to each `Location` before following it.
- **The GitHub rewrite runs first.** A `github.com/.../blob/...` URL is rewritten to `raw.githubusercontent.com`, and that host is the one checked.
- **`--allow-remote-host <host>`** exempts one named host from the address check, for an internal docs server that's a legitimate source. It's repeatable, with a matching `FileInjectorOptions` field. It follows the shape of `--allow-outside-root` and `--allow-env`. A redirect to a host that isn't itself allowed is still refused.

The redirect loop is the largest piece to build. It's worth testing against a local server rather than a mocked `fetch`.

### Limits

A 30-second overall timeout and a 10 MB cap on the response body. Both are fixed constants, and both fail as an ordinary read failure. A flag for each would be more surface than the problem needs.

### Reporting a refused destination

A refusal is explicit on the console, naming the policy and `--allow-remote-host`. The error comment written into the document is generic, the same as for any other unreachable URL.

This is the exception in the design principle [a denial says as much as it safely can](../../design-principles.md#a-denial-says-as-much-as-it-safely-can). Deciding this denial requires resolving the name. An explicit refusal in the document would tell the pull-request author that the name resolved, and to an internal address. They could map the runner's network one hostname per directive. The operator knows their own network and needs the diagnosis, so the console says everything.

The injection root and [deny-access](../deny-access/README.md) denials stay explicit in both places, because their verdicts reveal nothing about the machine.

The split needs a second reporting channel. Today a read failure is one `Error` whose message reaches both the console and the document.

### DNS rebinding stays open

The name is resolved once for the check and again by the connection. A name under attacker control with a very short TTL could answer public, then private. It needs attacker-controlled DNS, and only buys a request the tool would otherwise refuse.

## Open questions

- The console-versus-document split only helps if the pull-request author doesn't read the build log. That's false wherever CI logs are public, which they often are. Then the honest choices are explicit everywhere (accepting the DNS oracle) or generic everywhere (losing the operator's diagnosis). This changes what the code does, so it has to be settled before building ([#865](https://github.com/streetsidesoftware/inject-markdown/issues/865)).

## Alternatives

- A blanket `--allow-private-network`: it grants the whole network when the user needs one host.
- Connecting to the verified address to close DNS rebinding: correct, but it needs a custom lookup, the `Host` header kept, and care with TLS SNI and the redirect loop.

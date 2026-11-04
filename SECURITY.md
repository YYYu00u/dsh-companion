# Security policy

## Supported versions

The current `0.1.x` line is supported. This is a local-first plugin; there is no hosted service to patch.

## Reporting

Please **do not** open a public issue for a vulnerability. Use GitHub's private security advisory for this repository, or contact the maintainer through the address on their GitHub profile.

Include:

- DSH version and OS;
- the package and route/tool involved;
- a minimal reproduction (a temp home is fine);
- impact: what an attacker gains, and what access they need.

## Scope

In scope:

- The web server: loopback escape, CSRF, path traversal, XSS, arbitrary file read/write via API input.
- Prompt-injection paths that let browsed content cause unintended tool use beyond the documented `use_hands` task.
- Secret leakage in logs, errors, or committed files.
- Denial of service that persists (e.g., a request that corrupts the home).

Out of scope:

- An attacker who already has local shell access or can read the home directory. The web API intentionally has no login and the data is plain files.
- The model provider's own behavior.
- The Chrome MCP / dsh-pet / DSH itself; report those upstream.
- "The companion can be talked into saying something" — that is a content issue, not a security boundary. The companion has no shell or file tools.

## Design notes

- The web server binds to `127.0.0.1`; cross-site state changes are rejected via `Sec-Fetch-Site`.
- Static responses carry CSP and `nosniff`; uploaded images are type- and size-checked.
- The companion has no shell/file/approval tools. `use_hands` runs a separate child session with browser tools only.
- `.data/` is git-ignored. The plugins never read `.data/config.json`.
- There is no telemetry and no outbound call except the model provider and sites the companion explicitly visits.

## If you exposed the port

If you tunneled `4318` or put it behind a proxy without auth, assume the notebook, diary, and chat history are readable. Stop the tunnel, rotate any provider keys that were stored in that home, and review `.data/` for anything sensitive.

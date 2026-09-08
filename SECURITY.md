# Security

## Machine-room keys

Neko's private engine key belongs only in the server environment. Never commit `.dev.vars`, `.env`, `.env.local`, production credentials, or screenshots containing secrets. The browser calls the local Neko route; it never receives the key directly.

If a key is exposed, revoke it immediately in the provider dashboard, create a replacement, and review the account's usage.

## Reporting a vulnerability

Please report security issues privately to the repository owner instead of opening a public issue. Include the affected route, reproduction steps, expected impact, and any suggested mitigation. Do not include live credentials or other people's private data.

## Current safeguards

- server-side API access only;
- bounded message history and message length;
- per-visitor request throttling;
- upstream request timeout;
- response storage disabled;
- user-facing errors that do not leak provider details.

The included in-memory rate limit is suitable as a basic guardrail, not a substitute for a shared production rate-limit service when running multiple instances.

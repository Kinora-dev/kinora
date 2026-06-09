# Contributing to kinora

Thanks for your interest in contributing.

## Getting started

See the [Development](README.md#development) section for running the full stack locally. Before opening a PR:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

## Pull requests

- Branch off `main`, keep the change focused.
- Match the surrounding code style (ESLint owns formatting, no Prettier).
- Reference any related issue in the PR description.

## Licensing of contributions

kinora is [fair source](README.md#licensing).

By contributing, you agree that your contribution is licensed under the same license as the part of the repository you are changing:

- `server` and `web`: **FSL-1.1-MIT**
- `reporter`, `cli`, `core`, `ui`, `trace-viewer`: **MIT**

In other words, inbound = outbound: your contribution carries the same terms as the code it joins, including FSL's conversion to MIT two years after each release.

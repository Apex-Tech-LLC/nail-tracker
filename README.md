# Nail Tracker

A free, private pay tracker for nail technicians. Record each turn, and see your commission, cash tips, card tips, what you earned, and what the salon still owes you. English and Vietnamese. Works offline. No account. Your data stays on your phone.

**Try it:** https://apex-tech-llc.github.io/nail-tracker/. Open it in Safari on an iPhone, tap Share, then Add to Home Screen.

## Develop

    pnpm install
    pnpm dev
    pnpm gate

`pnpm gate` runs lint, typecheck, unit tests and the build. Browser tests: `pnpm exec playwright test --workers=2`.

The product document is [docs/product-spec.md](docs/product-spec.md). The build plan is in [tasks/nail-tracker](tasks/nail-tracker/tasks.md).

## Credit

Started as a fork of [Daftar](https://github.com/atefeh-sa93/daftar) by atefeh-sa93, under the MIT license. See [LICENSE](LICENSE).

# Contributing to Splidly

Thanks for helping improve Splidly.

## Before opening a pull request

1. Create an issue for substantial behavioral or data-model changes so the
   design can be agreed before implementation.
2. Never include real user data, credentials, private keys, rendered production
   configuration, database dumps, or production invitation links in code,
   fixtures, logs, screenshots, issues, or pull requests.
3. Preserve the mobile scrolling and non-selectable-text contracts documented
   in `AGENTS.md`.
4. Add or update tests for behavioral and security-sensitive changes.
5. Run:

   ```sh
   pnpm publication:check
   pnpm audit --prod
   pnpm typecheck
   pnpm test
   pnpm build
   git diff --check
   ```

Never use an iOS Simulator for this project. Perform required native visual
checks on physical devices.

## Security reports

Do not open a public issue for a suspected vulnerability. Follow the private
reporting instructions in `SECURITY.md`.

## Licensing

By submitting a contribution, you agree that it may be distributed under the
project's MIT License. Only submit work you have the right to contribute.
Third-party branding and artwork remain governed by `THIRD_PARTY_NOTICES.md`.

## Summary

Describe the change and its user-visible effect.

## Verification

- [ ] `pnpm publication:check`
- [ ] `pnpm audit --prod`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `git diff --check`
- [ ] Physical-device checks completed when mobile layout or navigation changed

## Security and privacy

- [ ] No credentials, production configuration, real user data, database dumps,
      private invitation links, or sensitive logs are included
- [ ] Authentication, authorization, retention, and privacy-policy implications
      were reviewed when applicable
- [ ] New dependencies and third-party assets have acceptable licenses and notices

# Publishing the source repository

This checklist covers publishing Splidly's source code. It does not certify a
production deployment or replace the controls in `SECURITY_OPERATIONS.md`.

## 1. Validate the exact commit

Start from a clean worktree and run:

```sh
pnpm install --frozen-lockfile
pnpm publication:check
pnpm audit --prod
pnpm typecheck
pnpm test
pnpm build
git diff --check
git status --short --ignored
```

Review ignored entries as well as tracked files. `.env`, private keys, database
dumps, backups, generated native projects, logs, and local IDE metadata must
remain ignored. Create source archives with `git archive`, not by compressing
the working directory.

The publication validator checks tracked paths and content, package publication
guards, third-party badge notices, and high-confidence secret signatures in
reachable Git history. It complements GitHub secret scanning; it cannot prove
that arbitrary text never contained a credential.

## 2. Review public identity and licensing

Publishing exposes contributor names and commit metadata. It also exposes
non-secret identifiers embedded in shipped applications, including bundle IDs,
store IDs, OAuth client IDs, signing-certificate fingerprints, and EAS project
IDs. Confirm that each published identifier is intentional.

Keep `LICENSE`, `THIRD_PARTY_NOTICES.md`, and dependency lockfiles in the public
repository. Store badges and third-party trademarks are not covered by the
project's MIT License. Forks must remove or replace branded assets they are not
authorized to use.

## 3. Configure GitHub before changing visibility

The repository includes least-privilege CI, CodeQL, Dependabot, dependency
review, CODEOWNERS, and a pull-request checklist. Before changing visibility:

- require the `Verify` check and at least one code-owner review on `main`;
- enable the dependency graph, Dependabot alerts and security updates;
- enable secret scanning, push protection, and validity checks where available;
- enable private vulnerability reporting;
- confirm CodeQL and dependency review run after the repository becomes public;
- disallow force pushes and branch deletion on `main`; and
- review administrators and deploy keys for least privilege.

Resolve every existing security alert before announcing the repository. Treat
any credential found in history as compromised: revoke or rotate it before
removing it from history.

## 4. Keep deployment state private

Never publish a rendered Compose configuration, production `.env`, provider
keys, APNs tokens, backup identity, database URL, encrypted backup recovery key,
or reverse-proxy certificate. Public source identifiers are not substitutes for
secret values.

Before deploying, use a separately managed production environment and run
`pnpm production:check`. Confirm that `info@splidly.site` and
`privacy@splidly.site` are monitored and that the live privacy policy matches
the actual hosting, Cloudflare, logging, backup, notification, and retention
configuration.

## 5. Release follow-up

Monitor dependency, CodeQL, secret-scanning, authentication, authorization,
backup, and error-rate alerts. Re-run the release checklist for every release.
For a production service handling real personal or financial records, arrange
an independent security assessment before broad launch and after substantial
authentication, authorization, or infrastructure changes.

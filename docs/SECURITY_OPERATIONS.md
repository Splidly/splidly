# Security operations

This runbook describes the controls that must accompany a production Splidly
deployment. It is operational guidance, not a substitute for a provider-specific
security review.

## Before deployment

- Generate independent, high-entropy database and Better Auth secrets. The
  server rejects placeholder or low-diversity production authentication
  secrets and non-HTTPS public URLs.
- Keep Apple and APNs private keys outside the repository with owner-only read
  permissions. Mount them through Compose secrets.
- Use the supplied Nginx configuration or equivalent TLS termination, request
  size limits, connection limits, rate limits, timeouts, and forwarded-header
  replacement. The API port must remain bound to loopback so clients cannot
  bypass the proxy.
- Review `docker compose config` without publishing it; rendered configuration
  contains secrets. Apply migrations before starting the API. The migration job
  also encrypts any legacy plaintext OAuth tokens with `BETTER_AUTH_SECRET`.
- Rebuild images when a pinned dependency image receives a security release.
  Never switch production services back to a floating `latest` tag.

## Secrets and rotation

- Store `.env`, private keys, backup identities, and reverse-proxy certificates
  outside source control. Grant access only to the deployment account.
- Treat `BETTER_AUTH_SECRET` as an encryption key as well as an authentication
  secret. Back it up in the secrets manager. Do not rotate or remove it without
  a planned token re-encryption and session invalidation procedure.
- Rotate provider keys immediately after suspected exposure. Revoke affected
  Apple, Google, and APNs credentials at the provider and invalidate all Splidly
  sessions.
- Never paste production tokens, database URLs, private keys, request bodies,
  database dumps, or rendered Compose configuration into issues or logs.

## Backups

`ops/backup.sh` refuses to create a backup unless `BACKUP_AGE_RECIPIENT` and the
`age` binary are available. Files are created with owner-only permissions,
retained locally for seven days, and should be copied to access-controlled
off-host storage. Protect the matching age identity separately from the backup.

Test an encrypted restore periodically in an isolated environment. Plaintext
legacy dumps require the explicit `ALLOW_PLAINTEXT_RESTORE=1` override and must
be securely removed immediately afterward.

## Monitoring and response

- Collect JSON server and reverse-proxy logs in access-controlled storage with
  a defined retention period. Alert on repeated 401, 403, 413, and 429 responses,
  authentication failures, unexpected 5xx spikes, and repeated provider-token
  failures.
- Monitor certificate expiry, database capacity, backup completion and restore
  tests, container health, provider-key expiry, and dependency advisories.
- For an incident: preserve relevant logs, restrict access, rotate exposed
  credentials, invalidate sessions, assess affected users and records, patch and
  redeploy, and complete legally required notifications within applicable
  deadlines.

## Release verification

Run before every release:

```sh
pnpm install --frozen-lockfile
pnpm audit --prod
pnpm typecheck
pnpm test
pnpm build
docker compose config --quiet
```

As of 2026-08-18, `pnpm audit --prod` reports two high-severity denial-of-service
advisories for `image-size` 2.0.2, reached only through Expo/Metro build tooling.
The audit lists 2.0.3 as fixed, but npm has not published that version yet. Do
not pass untrusted image files to Metro, and remove this exception as soon as a
patched release is available. All other advisories reported on that date are
resolved by the workspace overrides.

Also verify response security headers, rate-limit behavior, an encrypted backup
and restore, social sign-in, immediate sign-out/session revocation, account
deletion, and authorization with two unrelated test accounts.

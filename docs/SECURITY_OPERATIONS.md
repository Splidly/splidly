# Security operations

This runbook describes the controls that must accompany a production Splidly
deployment. It is operational guidance, not a substitute for a provider-specific
security review.

## Before deployment

- Generate independent, high-entropy database and Better Auth secrets. The
  server rejects placeholder or low-diversity production authentication
  secrets and non-HTTPS public URLs.
- Generate a separate `POSTGRES_RUNTIME_PASSWORD`. The migration container
  creates a least-privilege login for the API; never reuse the database-owner
  password for it.
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

`ops/backup.sh` creates an atomic, encrypted snapshot containing a PostgreSQL
custom-format dump plus the production `.env` and `/etc/splidly/secrets`. It
refuses to run without `age` and a readable age identity, validates both
encrypted streams before publishing the snapshot, prevents overlapping runs,
and removes snapshot directories once they are seven days old. Files and the
backup directory must remain root-only.

Frankfurter is excluded because its large historical exchange-rate database is
public and reconstructable. Backing it up every day would consume substantial
space without protecting user data.

The production systemd timer runs at 02:00 Europe/Berlin and catches up after
downtime. Same-server backups protect against accidental deletion and bad
deployments, but not disk or server loss. Copy encrypted snapshots off-host and
protect a copy of the matching age identity separately from both locations.

Test an encrypted restore periodically in an isolated environment. The restore
script accepts a complete snapshot directory and checks its hashes before
restoring PostgreSQL. Inspect and restore `config.tar.age` separately and with
care; it contains production secrets. Plaintext legacy dumps require the
explicit `ALLOW_PLAINTEXT_RESTORE=1` override and must be securely removed
immediately afterward.

Run `ops/verify-production-backup.sh` as root on the production host to verify
the latest snapshot by restoring it into a temporary, network-isolated
PostgreSQL container. The script refuses to reuse an existing container and
always removes its temporary database after the verification.

## Monitoring and response

- Collect sanitized JSON application logs and edge security events in
  access-controlled storage with a defined retention period. The supplied
  Nginx configuration disables raw access logs because invitation paths contain
  bearer credentials. Configure Cloudflare logging and analytics to avoid or
  redact full invitation URLs and keep only the shortest operational retention.
  Alert on repeated 401, 403, 413, and 429 responses,
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
pnpm publication:check
pnpm production:check
pnpm audit --prod
pnpm typecheck
pnpm test
pnpm build
docker compose config --quiet
```

The repository's CI repeats publication validation, dependency auditing,
typechecking, tests, and builds on every pull request. CodeQL and dependency
review activate for the public repository. Keep `main` protected and require
the CI `Verify` check plus a code-owner review before merging.

Also verify response security headers, rate-limit behavior, an encrypted backup
and restore, social sign-in, immediate sign-out/session revocation, account
deletion, and authorization with two unrelated test accounts.

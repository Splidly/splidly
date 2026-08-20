# Development and deployment setup

This guide covers local development, native services, and self-hosting. The
repository-root `.env` is the single environment file for the entire workspace.

## Local development

Requirements: Node 24, pnpm 11, Docker, Xcode for physical iOS builds, and the
Android Studio/SDK for Android builds.

```sh
corepack enable
pnpm install
cp .env.example .env
docker compose -f compose.dev.yaml up -d
pnpm db:migrate
pnpm dev:server
pnpm dev:mobile
```

Do not create `apps/mobile/.env.local`. The server, Expo app, and Metro all load
the root `.env`; only `EXPO_PUBLIC_` values are embedded in the mobile bundle.
Development PostgreSQL uses host port `5433` by default. Override
`POSTGRES_PORT` and update `DATABASE_URL` if required.

Expo Go is not supported because authentication and linking use native modules.
Use signed development builds on physical devices; do not use an iOS Simulator.
For device testing, set `API_PUBLIC_URL` and `EXPO_PUBLIC_API_URL` to a reachable
HTTPS development hostname.

Development builds expose **Continue as Demo User**. The development-only
credential provider creates an idempotent `Lisbon Weekend` group with fictional
members and expenses. Production hides and rejects this login method.

## Identity providers

Configure Google OAuth web, iOS, and Android clients. Put the web/iOS client IDs
in Expo public variables and the server client ID and secret in private server
variables.

For Sign in with Apple, create the required App ID, Services ID, and key. A
native-only setup may use the bundle ID as `APPLE_SIGN_IN_CLIENT_ID`; the
browser/Android production flow requires the Services ID. The server generates
a fresh 180-day client-secret JWT at startup and accepts `IOS_APP_ID` as the
native iOS token audience.

Keep `.p8` keys outside the repository:

```sh
install -d -m 700 "$HOME/Library/Application Support/Splidly/Secrets"
install -m 600 /path/to/AuthKey_KEYID.p8 \
  "$HOME/Library/Application Support/Splidly/Secrets/apple-sign-in.p8"
```

Use the full absolute path in `.env`; `~` is not expanded there.

```dotenv
APPLE_SIGN_IN_CLIENT_ID=com.example.splidly
APPLE_SIGN_IN_KEY_ID=KEYID
APPLE_SIGN_IN_PRIVATE_KEY_PATH="/Users/you/Library/Application Support/Splidly/Secrets/apple-sign-in.p8"
IOS_TEAM_ID=TEAMID
IOS_APP_ID=com.example.splidly
```

Set the final bundle ID and Apple Team ID before rebuilding the iOS app. Android
release configuration is deliberately deferred; set `ANDROID_ENABLED=true`, a
final package, and the Play signing SHA-256 fingerprint only when the Android
app is ready. Provider accounts are
linked only from authenticated accounts; provider emails are not used as public
identifiers or invite targets.

## Expense notifications

Splidly sends iOS notifications directly through APNs. Create separate Sandbox
and Production keys for `IOS_APP_ID`; delivery does not use Expo Push Service.

Physical development builds receive Sandbox tokens:

```dotenv
APNS_ENVIRONMENT=development
APNS_KEY_ID=SANDBOX_KEY_ID
APNS_PRIVATE_KEY_PATH="/Users/you/Library/Application Support/Splidly/Secrets/apns-development.p8"
```

TestFlight and App Store builds receive Production tokens, so deployed servers
must use `APNS_ENVIRONMENT=production` and the Production key. A server accepts
tokens only for its configured environment.

After permission is granted, expense create, update, and delete transactions
enqueue durable deliveries for other active group members. Users may limit
notifications to expenses involving them or enable five-minute smart summaries.
Transient failures are retried and unregistered tokens are disabled. Apply all
migrations and make a fresh native build after changing notification support.

## Universal and app links

The server publishes:

- `/.well-known/apple-app-site-association`
- `/.well-known/assetlinks.json`
- `/invite/:token`

Set the HTTPS `APP_DOMAIN` on the server and the same public origin in
`EXPO_PUBLIC_APP_URL`. Verify both association files and install a freshly
signed build before testing. After installing the app, invite recipients must
reopen the original invite link.

## Database and money model

```sh
pnpm db:generate
pnpm db:migrate
```

Money crosses API boundaries as `{ currency, minor }`, where `minor` is a
decimal integer string. Rates are decimal strings. Expense revisions preserve
source totals, splits, group and home-currency values, rate metadata, and an
immutable ledger; edits add compensating entries before the replacement.

Frankfurter's latest published rate is frozen when an expense is entered. A
manual rate can be supplied and is labelled accordingly.

## Logging

Production logs newline-delimited JSON to stdout. Local `pnpm dev` and
`pnpm dev:server` render readable blocks. Requests receive an `x-request-id`,
and secret-bearing values, bodies, cookies, authorization headers, APNs tokens,
and SQL parameters are excluded or redacted.

```sh
LOG_FORMAT=json pnpm dev:server
LOG_LEVEL=debug pnpm dev:server
```

`LOG_LEVEL` accepts `debug`, `info`, `warn`, `error`, or `fatal`. Debug mode
includes SQL text with placeholders and pool lifecycle events.

## Production

Copy `.env.production.example` to `.env`, replace every placeholder, and run:

```sh
pnpm production:check
docker compose config --quiet
docker compose up --build -d
docker compose ps
curl --fail --silent --show-error https://splidly.site/health/ready
```

`production:check` validates the domain, provider configuration, enabled store
IDs and signing identities, secret strength, readable key files, and the agreement
between server and mobile public configuration. It never prints secret values.
Production accepts a high-entropy 32-byte secret encoded as Base64 or Base64URL
(43 characters unpadded or 44 characters padded). Generate independent secrets
rather than editing the example strings, for example with
`openssl rand -base64 48`.

The API binds to `127.0.0.1:${API_BIND_PORT:-4000}` for a host reverse proxy.
An Nginx example is available at `ops/nginx-splidly.conf`. PostgreSQL and the
private Frankfurter service remain on the internal Docker network, and
migrations must complete before the server starts. The migration job also
encrypts existing OAuth tokens; new tokens are encrypted when written. Keep
`BETTER_AUTH_SECRET` available to both the migration and server containers.
The Nginx configuration expects a certificate at
`/etc/letsencrypt/live/splidly.site/`; obtain or restore that certificate before
enabling the HTTPS server block.

Install production keys outside the repository:

```sh
sudo install -d -m 700 /etc/splidly/secrets
sudo install -m 600 /path/to/AuthKey_KEYID.p8 \
  /etc/splidly/secrets/apple-sign-in.p8
sudo install -m 600 /path/to/AuthKey_APNS_KEYID.p8 \
  /etc/splidly/secrets/apns-production.p8
```

Set `APPLE_SIGN_IN_PRIVATE_KEY_FILE` and `APNS_PRIVATE_KEY_FILE` to those paths.
Compose mounts them read-only for the API. Verify access without printing keys:

```sh
docker compose run --rm --no-deps server \
  sh -c 'test -r /run/secrets/apple_sign_in_key && test -r /run/secrets/apns_key'
```

If Linux bind-mount ownership blocks the container's numeric `node` user:

```sh
sudo chown 1000:1000 /etc/splidly/secrets/apple-sign-in.p8
sudo chown 1000:1000 /etc/splidly/secrets/apns-production.p8
sudo chmod 400 /etc/splidly/secrets/apple-sign-in.p8 \
  /etc/splidly/secrets/apns-production.p8
```

## Backups

Install [`age`](https://age-encryption.org/) and create a root-only identity.
Install the supplied systemd units to run an encrypted backup every day at
02:00 Europe/Berlin. Successful snapshots are retained for exactly seven days;
the timer catches up after server downtime.

```sh
sudo install -d -m 700 /etc/splidly /var/backups/splidly
sudo age-keygen -o /etc/splidly/backup.agekey
sudo chmod 600 /etc/splidly/backup.agekey
sudo install -m 644 ops/systemd/splidly-backup.service /etc/systemd/system/
sudo install -m 644 ops/systemd/splidly-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now splidly-backup.timer
sudo systemctl start splidly-backup.service
sudo systemctl status splidly-backup.timer
```

Each root-only snapshot contains a validated encrypted PostgreSQL dump and an
encrypted configuration archive. Frankfurter is excluded because its public
exchange-rate cache can be rebuilt. To restore the database after testing the
procedure in an isolated environment:

```sh
sudo env BACKUP_AGE_IDENTITY=/etc/splidly/backup.agekey \
  ./ops/restore.sh /var/backups/splidly/splidly-TIMESTAMP
```

Copy encrypted backups and the age identity to separate, access-controlled
off-host locations when a second storage location becomes available. Without
that, these backups do not protect against loss of the server or its disk.

Review [Security operations](SECURITY_OPERATIONS.md) before exposing a
production instance.

## Verification and store delivery

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm dlx expo-doctor@latest apps/mobile
```

Verify Apple/Google authentication and universal links on signed physical-device
builds. Version 1.0.0 is an iPhone/iPad release. Production EAS builds use the
dedicated `production` environment and fail if final URLs, the iOS bundle ID,
or Google clients are missing or inconsistent. Configure these public project
variables in EAS:

```text
EXPO_PUBLIC_API_URL
EXPO_PUBLIC_APP_URL
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
GOOGLE_IOS_REVERSED_CLIENT_ID
IOS_APP_ID
```

Then build and submit through the pinned EAS CLI:

```sh
pnpm --filter @splidly/mobile build:production:ios
pnpm --filter @splidly/mobile submit:ios
```

The default `build:production` command is also iOS-only. Android production
builds are blocked while `ANDROID_ENABLED=false`, and no Android submission
command is exposed. When Android is release-ready, add its final package,
certificate fingerprint, store URL, EAS variable, and submission profile, then
enable it only after Play Console testing. EAS remotely owns the monotonically
increasing iOS build number.

The same iOS binary supports iPhone and iPad; no separate iPad app or build is
needed. Before submission, test the signed build on a physical iPad and upload
the required iPad screenshots in App Store Connect. See
`apps/mobile/APP_STORE_CONNECT.md` for the device checklist.

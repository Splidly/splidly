# Splidly

Splidly is a self-hosted shared-expense app for iOS and Android. It uses Expo Router, tRPC, Better Auth, PostgreSQL/Drizzle, and frozen Frankfurter currency conversions.

## Workspace

- `apps/mobile` — Expo SDK 57 client with Friends and Groups tabs.
- `apps/server` — Hono HTTP server, Better Auth, tRPC, invite/deletion pages, and association files.
- `packages/db` — Drizzle schema and generated PostgreSQL migrations.
- `packages/shared` — runtime contracts and integer-only money/conversion utilities.
- `compose.yaml` — server, PostgreSQL, migrations, and a private Frankfurter instance for deployment behind a host reverse proxy.

## Local development

Requirements: Node 24, pnpm 11, Docker, Xcode for iOS, and Android Studio/SDK for Android.

```sh
corepack enable
pnpm install
cp .env.example .env
docker compose -f compose.dev.yaml up -d
pnpm db:migrate
pnpm dev:server
pnpm dev:mobile
```

The repository-root `.env` is the single environment file for local
development. The server loads it directly, while the Expo app and Metro
configuration explicitly load the same file. Do not create an
`apps/mobile/.env.local`; keep mobile-safe values such as
`EXPO_PUBLIC_API_URL` alongside the server values in the root `.env`. Only
variables prefixed with `EXPO_PUBLIC_` are embedded in the mobile JavaScript
bundle.

The development PostgreSQL container listens on host port `5433` by default
to avoid conflicting with a locally installed PostgreSQL server. Override it
with `POSTGRES_PORT` and update `DATABASE_URL` if needed.

## Server logging

The server writes newline-delimited structured JSON to stdout. Every HTTP
request receives an `x-request-id`; a valid incoming ID is preserved so mobile,
reverse-proxy, and server logs can be correlated. Request completion, tRPC
procedure results, authenticated user IDs, database query shapes, auth setup,
currency-provider calls, notification delivery/retries, pool failures, startup,
and shutdown are logged. Secret-bearing fields are redacted and request bodies,
cookies, authorization headers, APNs tokens, and SQL parameter values are never
logged.

Set `LOG_LEVEL` to `debug`, `info`, `warn`, `error`, or `fatal`. Local defaults
use `debug`, while the production example uses `info`. Debug logging includes
SQL text with placeholders and pool lifecycle events; use it temporarily in
production when diagnosing a problem:

```sh
LOG_LEVEL=debug docker compose up -d server
docker compose logs -f server
```

The native auth and linking modules require development builds; Expo Go is not supported:

```sh
pnpm --filter @splidly/mobile ios
pnpm --filter @splidly/mobile android
```

Development builds show a **Continue as Demo User** action. The credential
provider backing this shared local account is enabled only when
`NODE_ENV=development`; production builds hide the action and production
servers reject credential authentication.

For a physical device, set `API_PUBLIC_URL` and `EXPO_PUBLIC_API_URL` to an HTTPS development hostname reachable from that device.

Keep the Sign in with Apple `.p8` key outside the repository. On macOS, a
conventional local location is:

```sh
install -d -m 700 "$HOME/Library/Application Support/Splidly/Secrets"
install -m 600 /path/to/AuthKey_KEYID.p8 \
  "$HOME/Library/Application Support/Splidly/Secrets/apple-sign-in.p8"
```

Then configure the server-only values in the root `.env` using the full
absolute path (a path in an environment file does not expand `~`):

```dotenv
APPLE_SIGN_IN_CLIENT_ID=com.example.splidly
APPLE_SIGN_IN_KEY_ID=KEYID
APPLE_SIGN_IN_PRIVATE_KEY_PATH="/Users/you/Library/Application Support/Splidly/Secrets/apple-sign-in.p8"
IOS_TEAM_ID=TEAMID
IOS_APP_ID=com.example.splidly
```

## Identity provider setup

1. Configure Google OAuth web, iOS, and Android clients. Add the web/iOS client IDs to the Expo public environment and the server client ID/secret to its private environment.
2. Configure Sign in with Apple for the iOS bundle. For native-only testing,
   `APPLE_SIGN_IN_CLIENT_ID` can be the bundle ID; for the production
   browser/Android flow, create a Services ID and use that as
   `APPLE_SIGN_IN_CLIENT_ID`. Give the server the key ID and path to the
   downloaded `.p8` private key. The server uses
   `jose` to generate a fresh 180-day Apple client-secret JWT at startup and
   uses `IOS_APP_ID` as the accepted audience for native iOS identity tokens.
3. Set the final iOS bundle ID, Apple Team ID, Android package, and Android signing SHA-256 fingerprint.
4. Rebuild both native projects after changing identifiers, schemes, associated domains, or auth plugins.

Provider accounts are linked only from an authenticated account. Emails returned by providers are never used for invites or surfaced as a product identifier.

## Expense notifications

Splidly sends iOS expense notifications directly through APNs. Create
topic-specific Sandbox and Production APNs keys for `IOS_APP_ID`, download each
`.p8` once, and keep both outside the repository. `expo-notifications` handles
the native permission, token, and response APIs in the app; notification
delivery does not use the Expo Push Service.

A physical-device development build receives a development APNs token and
therefore uses a local server configured with the Sandbox key:

```dotenv
APNS_ENVIRONMENT=development
APNS_KEY_ID=SANDBOX_KEY_ID
APNS_PRIVATE_KEY_PATH="/Users/you/Library/Application Support/Splidly/Secrets/apns-development.p8"
```

TestFlight and App Store builds receive production APNs tokens, so the deployed
server must use `APNS_ENVIRONMENT=production` with the Production key. Each
server instance intentionally accepts tokens from only its configured APNs
environment.

Native APNs tokens are registered only after an authenticated, onboarded user
grants notification permission. Expense create, update, and delete transactions
enqueue one durable delivery per active iOS installation; the server retries
transient APNs failures and disables tokens rejected as unregistered. Apply the
database migrations and make a fresh native build after adding notification
support—the JavaScript bundle alone cannot add the iOS push entitlement.

## Universal and app links

The server publishes:

- `/.well-known/apple-app-site-association`
- `/.well-known/assetlinks.json`
- `/invite/:token`

Set one real HTTPS `APP_DOMAIN` in the server and `EXPO_PUBLIC_APP_URL` in the mobile build. Verify both association files after deployment, then install a freshly signed build before testing. Recipients without the app install it and reopen the original invite; there is no third-party deferred-link dependency.

## Database and money model

Generate and apply migrations with:

```sh
pnpm db:generate
pnpm db:migrate
```

Money crosses API boundaries as `{ currency, minor }`, with `minor` represented as a decimal integer string. Rates are decimal strings. Expense writes store the source total, all splits, the group total, both parties’ home-currency valuations, provider/date/source metadata, and immutable ledger entries. Edits append compensating ledger entries before the replacement revision.

Frankfurter’s latest published rate is fetched when the expense is entered. Every rate can be explicitly overridden and is then labelled `manual`.

## Production

Copy `.env.production.example` to `.env`, replace every placeholder, and run:

```sh
docker compose config
docker compose up --build -d
docker compose ps
curl https://your-domain.example/health/ready
```

The API binds to `127.0.0.1:${API_BIND_PORT:-4000}` for a host-managed reverse
proxy such as Nginx. Point the public HTTPS virtual host at that loopback port
using the example in `ops/nginx-splidly.conf`. PostgreSQL and Frankfurter remain
on an internal Docker network; only the API receives outbound network access.
The migration job must complete before the server starts.

Install the Apple private key on the production host before starting Compose:

```sh
sudo install -d -m 700 /etc/splidly/secrets
sudo install -m 600 /path/to/AuthKey_KEYID.p8 \
  /etc/splidly/secrets/apple-sign-in.p8
sudo install -m 600 /path/to/AuthKey_APNS_KEYID.p8 \
  /etc/splidly/secrets/apns-production.p8
```

Set `APPLE_SIGN_IN_PRIVATE_KEY_FILE=/etc/splidly/secrets/apple-sign-in.p8` and
`APNS_PRIVATE_KEY_FILE=/etc/splidly/secrets/apns-production.p8` in the
production `.env`. Compose grants only the API service access and mounts both
read-only; the key contents never enter the container environment or image.
Verify that the non-root API user can read the mounts without printing them:

```sh
docker compose run --rm --no-deps server \
  sh -c 'test -r /run/secrets/apple_sign_in_key && test -r /run/secrets/apns_key'
```

If that check fails on Linux because the source file ownership is preserved by
the bind mount, make it readable only by the container's numeric `node` user:

```sh
sudo chown 1000:1000 /etc/splidly/secrets/apple-sign-in.p8
sudo chown 1000:1000 /etc/splidly/secrets/apns-production.p8
sudo chmod 400 /etc/splidly/secrets/apple-sign-in.p8 \
  /etc/splidly/secrets/apns-production.p8
```

### Backups

Install [`age`](https://age-encryption.org/), set an `BACKUP_AGE_RECIPIENT`, and schedule this daily:

```sh
BACKUP_AGE_RECIPIENT=age1... ./ops/backup.sh
```

Backups are retained locally for seven days. Copy encrypted files to independent off-host storage. Test restoration periodically in a disposable deployment:

```sh
./ops/restore.sh backups/splidly-TIMESTAMP.sql.gz.age
```

## Verification

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm dlx expo-doctor@latest apps/mobile
```

Real Apple/Google auth and universal links must also be verified on signed physical-device builds. For store delivery, build and sign locally, then use `pnpm --filter @splidly/mobile submit:ios` or `submit:android`.

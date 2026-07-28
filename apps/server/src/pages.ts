import type { Env } from "./env";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { font-family: ui-rounded, system-ui, sans-serif; color: #17211b; background: #f4f7f4; }
      body { box-sizing: border-box; margin: 0; min-height: 100vh; padding: 1rem; display: grid; place-items: center; }
      main { box-sizing: border-box; width: min(92vw, 38rem); padding: 2rem; border-radius: 1.5rem; background: white; box-shadow: 0 16px 50px #14251b18; }
      h1 { margin: 0 0 .65rem; font-size: 2rem; }
      h2 { margin: 1.7rem 0 .55rem; font-size: 1.2rem; }
      p, li { color: #526158; line-height: 1.55; }
      ul { padding-left: 1.3rem; }
      a { color: #246b45; }
      .button { display: block; box-sizing: border-box; padding: .9rem 1rem; margin-top: .75rem; border: 0; border-radius: .8rem; text-align: center; text-decoration: none; font: inherit; font-weight: 700; background: #246b45; color: white; cursor: pointer; width: 100%; }
      .secondary { background: #e7efe9; color: #1c5537; }
      .danger { background: #a92d2d; }
      small { color: #6c766f; }
      @media (prefers-color-scheme: dark) { :root { color: #eef7f1; background: #101713; } main { background: #17221b; } p, li, small { color: #b8c7bd; } a { color: #8dd5aa; } .secondary { background: #263d2f; color: #dcf3e4; } }
    </style>
  </head>
  <body><main>${body}</main></body>
</html>`;
}

export function invitePage(token: string, env: Env): string {
  const safeToken = escapeHtml(token);
  return layout(
    "Open invite · Splidly",
    `<h1>You’ve been invited</h1>
     <p>Open Splidly to preview who invited you and decide whether to accept.</p>
     <a class="button" href="${escapeHtml(env.APP_SCHEME)}://invite/${safeToken}">Open Splidly</a>
     <a class="button secondary" href="${escapeHtml(env.IOS_STORE_URL)}">Install for iPhone</a>
     <a class="button secondary" href="${escapeHtml(env.ANDROID_STORE_URL)}">Install for Android</a>
     <p><small>If you install the app now, return to this original invite link afterward.</small></p>`,
  );
}

export function privacyPage(): string {
  return layout(
    "Privacy · Splidly",
    `<h1>Privacy Policy</h1>
     <p><small>Effective July 28, 2026</small></p>
     <p>Splidly is a shared-expense ledger. It records who paid, how a cost was split, and the settlements people record themselves. Splidly does not move money, show advertising, sell personal data, or use personal data for advertising tracking.</p>

     <h2>Data Splidly collects</h2>
     <ul>
       <li><strong>Account and profile data:</strong> the account identifier, name, email address, and profile-image URL provided by Apple or Google; your display name and home currency; and authentication tokens needed to keep you signed in.</li>
       <li><strong>Shared-ledger data:</strong> friendships, groups and memberships, invitations, expense descriptions and notes, dates, amounts, currencies, payers, splits, exchange-rate snapshots, settlements, and the resulting ledger history.</li>
       <li><strong>Security and session data:</strong> session identifiers and expiry times, IP address, and user-agent information used to authenticate requests and protect the service.</li>
       <li><strong>On-device data:</strong> the app stores session credentials, pending invitation details, and recently selected currencies in protected device storage.</li>
     </ul>
     <p>Names, expense details, notes, balances, and settlements are visible to the other people who participate in the applicable friendship or group.</p>

     <h2>How the data is used</h2>
     <p>Splidly uses this data only to create and secure accounts, synchronize shared ledgers, calculate balances and currency conversions, process invitations, provide account support, and maintain the reliability and security of the service.</p>

     <h2>Service providers</h2>
     <ul>
       <li><strong>Apple and Google:</strong> if you choose one of these sign-in methods, that provider processes the sign-in and gives Splidly the account information described above. <a href="https://www.apple.com/legal/privacy/">Apple’s privacy policy</a> or <a href="https://policies.google.com/privacy">Google’s privacy policy</a> applies to the provider’s processing. The Google Sign-In software may also process coarse location, device and user identifiers, phone number, and usage data for app functionality and analytics; it declares that this data is not used for tracking.</li>
       <li><strong>Currency-rate service:</strong> Splidly uses a private Frankfurter service for reference exchange rates. It receives requested currency pairs and dates, not your identity, group names, expense descriptions, or notes.</li>
       <li><strong>Hosting infrastructure:</strong> the server, database, and backups are processed by infrastructure providers only as needed to operate and protect Splidly. Providers are required to protect data consistently with this policy.</li>
     </ul>

     <h2>Retention and deletion</h2>
     <p>Account and ledger data is retained while your account is active. You can delete your account in Profile after settling your balances and leaving active groups. Deletion removes provider connections, authentication tokens, active sessions, invitations you created, your name, email address, and profile image from the active account.</p>
     <p>Shared financial records cannot always be removed without changing other participants’ ledgers. Splidly therefore retains a de-identified account record, shared expense and settlement history, currency snapshots, and audit revisions needed to preserve those ledgers. These records retain a random internal identifier but no longer retain your provider connection, name, email address, or profile image. If backups are enabled, they use a seven-day retention schedule, so deleted data may remain in a protected backup until that backup expires.</p>
     <p>Splidly may retain limited information for longer when required by law or reasonably necessary to resolve abuse, fraud, security, or legal issues.</p>

     <h2>Your choices</h2>
     <p>You can edit your display name and home currency, sign out, or start account deletion from Profile. You can also revoke Splidly’s access through your Apple or Google account settings. For access, correction, a portable copy of your data, or another privacy request, email <a href="mailto:privacy@splidly.site">privacy@splidly.site</a>.</p>

     <h2>Security</h2>
     <p>Splidly uses HTTPS in transit, protected device storage for session credentials, and access controls for servers, databases, and backups. No internet service can guarantee absolute security.</p>

     <h2>Changes and contact</h2>
     <p>This policy may be updated when Splidly’s features or providers change. Material changes will be reflected here with a new effective date. Splidly is operated by the developer identified on its App Store listing. Privacy questions can be sent to <a href="mailto:privacy@splidly.site">privacy@splidly.site</a>.</p>`,
  );
}

export function deletionPage(signedIn: boolean): string {
  if (signedIn) {
    return layout(
      "Delete account · Splidly",
      `<h1>Delete your account</h1>
       <p>You must settle all balances and leave every group first. Your identity and provider sessions will be removed; anonymized shared ledger facts remain for other participants.</p>
       <form method="post"><input type="hidden" name="confirmation" value="DELETE" /><button class="button danger" type="submit">Permanently delete account</button></form>`,
    );
  }
  return layout(
    "Delete account · Splidly",
    `<h1>Delete your account</h1>
     <p>Sign in with the same provider you use in Splidly. You’ll be returned here to confirm deletion.</p>
     <button class="button" onclick="signIn('google')">Continue with Google</button>
     <button class="button secondary" onclick="signIn('apple')">Continue with Apple</button>
     <script>
       async function signIn(provider) {
         const response = await fetch('/api/auth/sign-in/social', {
           method: 'POST',
           credentials: 'include',
           headers: { 'content-type': 'application/json' },
           body: JSON.stringify({ provider, callbackURL: '/account/delete' })
         });
         const value = await response.json();
         if (value.url) location.assign(value.url);
         else alert(value.message || 'Could not start sign in');
       }
     </script>`,
  );
}

export function deletionResultPage(success: boolean, message?: string): string {
  return layout(
    success ? "Account deleted · Splidly" : "Could not delete · Splidly",
    success
      ? `<h1>Account deleted</h1><p>Your Splidly identity and sessions have been removed.</p>`
      : `<h1>Account not deleted</h1><p>${escapeHtml(message ?? "Please settle balances and leave groups, then try again.")}</p>`,
  );
}

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
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; }
      main { width: min(92vw, 32rem); padding: 2rem; border-radius: 1.5rem; background: white; box-shadow: 0 16px 50px #14251b18; }
      h1 { margin: 0 0 .65rem; font-size: 2rem; }
      p { color: #526158; line-height: 1.55; }
      .button { display: block; box-sizing: border-box; padding: .9rem 1rem; margin-top: .75rem; border: 0; border-radius: .8rem; text-align: center; text-decoration: none; font: inherit; font-weight: 700; background: #246b45; color: white; cursor: pointer; width: 100%; }
      .secondary { background: #e7efe9; color: #1c5537; }
      .danger { background: #a92d2d; }
      small { color: #6c766f; }
      @media (prefers-color-scheme: dark) { :root { color: #eef7f1; background: #101713; } main { background: #17221b; } p, small { color: #b8c7bd; } .secondary { background: #263d2f; color: #dcf3e4; } }
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
    `<h1>Privacy</h1>
     <p>Splidly stores account identity, group membership, expenses, settlements, and frozen currency conversions solely to provide shared-expense accounting. It does not use email for invitations or advertising.</p>
     <p>You can export or delete your account from Settings. Shared ledger facts may be retained in anonymized form after all balances are settled.</p>`,
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


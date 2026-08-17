import type { Env } from "./env";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function documentLayout(title: string, body: string): string {
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

function appStoreLinks(env: Env): string {
  return `<div class="store-links" aria-label="Download Splidly">
    <a class="store-badge-link" href="${escapeHtml(env.IOS_STORE_URL)}" aria-label="Download Splidly on the App Store">
      <img class="store-badge app-store-badge" src="/app-store-badge.svg" alt="Download on the App Store" />
    </a>
    <a class="store-badge-link" href="${escapeHtml(env.ANDROID_STORE_URL)}" aria-label="Get Splidly on Google Play">
      <img class="store-badge google-play-badge" src="/google-play-badge.png" alt="Get it on Google Play" />
    </a>
  </div>`;
}

export function landingPage(env: Env): string {
  const stores = appStoreLinks(env);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="theme-color" content="#f7f7f2" />
    <meta name="description" content="Splidly makes shared expenses simple for trips, homes, and everyday plans." />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Splidly — Split the cost. Keep the good part." />
    <meta property="og:description" content="A calm, clear way to track shared expenses and settle up." />
    <meta property="og:url" content="https://splidly.site/" />
    <meta property="og:image" content="https://splidly.site/og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Splidly — Split the cost. Keep the good part." />
    <meta name="twitter:description" content="A calm, clear way to track shared expenses and settle up." />
    <meta name="twitter:image" content="https://splidly.site/og.png" />
    <title>Splidly — Shared expenses, made simple</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-rounded, "SF Pro Rounded", "SF Pro Display", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #17171c;
        background: #f7f7f2;
        font-synthesis: none;
        --ink: #17171c;
        --muted: #65656f;
        --soft: #f0f0ea;
        --line: rgba(23, 23, 28, .1);
        --purple: #5856d6;
        --purple-dark: #4644b9;
        --mint: #dff4e9;
        --positive: #16845b;
        --coral: #f2aa92;
      }
      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body { margin: 0; min-width: 320px; background: #f7f7f2; overflow-x: hidden; }
      a { color: inherit; }
      a:focus-visible { outline: 3px solid rgba(88, 86, 214, .38); outline-offset: 4px; }
      .shell { width: min(1180px, calc(100% - 48px)); margin: 0 auto; }
      .nav { height: 88px; display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 20; }
      .brand { display: inline-flex; align-items: center; gap: 11px; text-decoration: none; font-size: 21px; font-weight: 780; letter-spacing: -.04em; }
      .brand-mark { width: 35px; height: 35px; display: grid; place-items: center; border-radius: 11px; background: var(--purple); color: white; box-shadow: inset 0 0 0 1px rgba(255,255,255,.18), 0 7px 18px rgba(88,86,214,.22); font-size: 20px; font-weight: 800; letter-spacing: -.08em; }
      .nav-links { display: flex; align-items: center; gap: 30px; font-size: 14px; font-weight: 650; }
      .nav-links a { text-decoration: none; color: #515159; }
      .nav-links .nav-cta { padding: 11px 17px; border-radius: 999px; background: var(--ink); color: white; transition: transform .2s ease, background .2s ease; }
      .nav-links .nav-cta:hover { transform: translateY(-2px); background: var(--purple); }
      .hero { min-height: 760px; display: grid; grid-template-columns: .92fr 1.08fr; gap: clamp(42px, 7vw, 96px); align-items: center; padding: 54px 0 95px; }
      .eyebrow { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 24px; padding: 7px 11px 7px 8px; border: 1px solid var(--line); border-radius: 999px; background: rgba(255,255,255,.62); color: #52525b; font-size: 13px; font-weight: 700; }
      .eyebrow-dot { width: 22px; height: 22px; display: grid; place-items: center; border-radius: 50%; background: var(--mint); color: var(--positive); font-size: 12px; }
      h1 { max-width: 650px; margin: 0; font-size: clamp(52px, 6.5vw, 88px); line-height: .96; letter-spacing: -.067em; font-weight: 790; }
      .hero-copy > p { max-width: 510px; margin: 28px 0 32px; color: var(--muted); font-size: clamp(18px, 2vw, 21px); line-height: 1.55; letter-spacing: -.015em; }
      .store-links { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
      .store-badge-link { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; transition: transform .2s ease, filter .2s ease; }
      .store-badge-link:hover { transform: translateY(-3px); filter: drop-shadow(0 10px 14px rgba(23,23,28,.12)); }
      .store-badge { display: block; width: auto; }
      .app-store-badge { height: 56px; }
      .google-play-badge { height: 82px; margin: -13px -11px; }
      .hero-note { margin-top: 20px; color: #81818a; font-size: 12px; font-weight: 600; }
      .product-stage { position: relative; min-height: 620px; display: grid; place-items: center; isolation: isolate; }
      .product-stage::before { content: ""; position: absolute; z-index: -2; width: min(600px, 100%); aspect-ratio: 1; border-radius: 46% 54% 58% 42% / 47% 38% 62% 53%; background: linear-gradient(145deg, #e2dfdb 0%, #d9d7f5 52%, #c8e8d8 100%); transform: rotate(-7deg); }
      .product-stage::after { content: ""; position: absolute; z-index: -1; inset: 7% 4%; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,.95) 0%, rgba(255,255,255,0) 68%); filter: blur(18px); }
      .device { width: 306px; padding: 7px; border-radius: 52px; background: #111115; box-shadow: 0 40px 80px rgba(32,32,40,.28), 0 10px 25px rgba(32,32,40,.13), inset 0 0 0 1px rgba(255,255,255,.16); }
      .hero-device { position: relative; z-index: 3; transform: rotate(-4deg) translateX(-74px); }
      .hero-stats-device { position: absolute; z-index: 5; width: 218px; right: -1px; bottom: 20px; transform: rotate(7deg); }
      .app-preview-image { display: block; width: 100%; aspect-ratio: 943 / 2048; border-radius: 45px; object-fit: cover; background: #f2f2f7; }
      .promise { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
      .promise-inner { min-height: 102px; display: flex; align-items: center; justify-content: center; gap: 0; color: #62626b; font-size: 14px; font-weight: 700; }
      .promise-inner span { display: flex; align-items: center; white-space: nowrap; }
      .promise-inner span:not(:last-child)::after { content: ""; width: 4px; height: 4px; margin: 0 25px; border-radius: 50%; background: var(--purple); }
      .steps { padding: 96px 0 146px; }
      .section-heading { max-width: 680px; margin-bottom: 66px; }
      .section-heading small { color: var(--purple); font-size: 12px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
      .section-heading h2 { margin: 16px 0 0; font-size: clamp(39px, 5vw, 62px); line-height: 1.04; letter-spacing: -.055em; }
      .step-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
      .step { min-height: 270px; display: flex; flex-direction: column; padding: 28px; border: 1px solid var(--line); border-radius: 26px; background: rgba(255,255,255,.58); }
      .step-number { width: 41px; height: 41px; display: grid; place-items: center; border-radius: 13px; background: var(--soft); color: var(--purple); font-size: 12px; font-weight: 800; }
      .step:nth-child(2) .step-number { background: #e2f3e9; color: var(--positive); }
      .step:nth-child(3) .step-number { background: #f8e6df; color: #9b533b; }
      .step h3 { margin: auto 0 10px; font-size: 24px; letter-spacing: -.04em; }
      .step p { margin: 0; color: var(--muted); font-size: 15px; line-height: 1.55; }
      .showcase { padding: 0 0 132px; }
      .showcase-card { position: relative; min-height: 630px; overflow: hidden; display: grid; grid-template-columns: .82fr 1.18fr; align-items: center; padding: 72px; border-radius: 42px; background: #19191f; color: white; }
      .showcase-copy { position: relative; z-index: 5; max-width: 420px; }
      .showcase-copy small { color: #aaa9ff; font-size: 12px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
      .showcase-copy h2 { max-width: 390px; margin: 17px 0 19px; font-size: clamp(38px, 4vw, 56px); line-height: 1.02; letter-spacing: -.055em; }
      .showcase-copy p { margin: 0; color: #b8b8c1; font-size: 17px; line-height: 1.6; }
      .showcase-visual { position: relative; height: 540px; }
      .showcase-device { position: absolute; width: 242px; box-shadow: 0 38px 90px rgba(0,0,0,.45); }
      .showcase-group-device { z-index: 2; left: 2%; top: 48px; transform: rotate(-5deg); }
      .showcase-statistics-device { z-index: 3; right: 1%; top: -8px; transform: rotate(4deg); }
      .open-source { padding: 112px 0 0; }
      .open-source-card { display: grid; grid-template-columns: 1.2fr .8fr auto; align-items: center; gap: 48px; padding: 42px 48px; border: 1px solid var(--line); border-radius: 28px; background: rgba(255,255,255,.58); }
      .open-source-copy small { color: var(--purple); font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
      .open-source-copy h2 { margin: 10px 0 9px; font-size: 34px; letter-spacing: -.045em; }
      .open-source-copy p { max-width: 490px; margin: 0; color: var(--muted); font-size: 15px; line-height: 1.55; }
      .collaborators > span { display: block; margin-bottom: 12px; color: #85858e; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
      .collaborator-list { display: flex; flex-wrap: wrap; gap: 9px; }
      .collaborator { display: inline-flex; align-items: center; gap: 8px; padding: 7px 11px 7px 8px; border: 1px solid var(--line); border-radius: 999px; background: white; text-decoration: none; font-size: 12px; font-weight: 700; }
      .collaborator-initial { width: 25px; height: 25px; display: grid; place-items: center; border-radius: 50%; background: #e5e4f7; color: var(--purple-dark); font-size: 9px; font-weight: 800; }
      .collaborator:nth-child(2) .collaborator-initial { background: #dff1e7; color: #216b4b; }
      .repo-button { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 19px; border-radius: 999px; background: var(--ink); color: white; text-decoration: none; white-space: nowrap; font-size: 13px; font-weight: 750; transition: transform .2s ease, background .2s ease; }
      .repo-button:hover { transform: translateY(-2px); background: var(--purple); }
      .cta { padding: 0 0 120px; text-align: center; }
      .cta-inner { position: relative; overflow: hidden; padding: 100px 32px; border-radius: 40px; background: linear-gradient(145deg, #dcdaf4, #d8efe2); }
      .cta-inner::before, .cta-inner::after { content: ""; position: absolute; width: 230px; height: 230px; border-radius: 50%; filter: blur(1px); opacity: .55; }
      .cta-inner::before { left: -100px; bottom: -115px; background: #a8a4ef; }
      .cta-inner::after { right: -80px; top: -130px; background: #a9dfc2; }
      .cta h2 { position: relative; margin: 0 auto 17px; max-width: 780px; font-size: clamp(42px, 6vw, 72px); line-height: .98; letter-spacing: -.06em; }
      .cta p { position: relative; margin: 0 auto 30px; color: #5d5d66; font-size: 17px; }
      .cta .store-links { position: relative; justify-content: center; }
      footer { padding: 31px 0 42px; border-top: 1px solid var(--line); }
      .footer-inner { display: flex; align-items: center; justify-content: space-between; color: #75757e; font-size: 12px; }
      .footer-links { display: flex; gap: 22px; }
      .footer-links a { text-decoration: none; }
      @media (max-width: 900px) {
        .hero { grid-template-columns: 1fr; padding-top: 36px; text-align: center; }
        .hero-copy { position: relative; z-index: 10; }
        .hero-copy > p { margin-left: auto; margin-right: auto; }
        .hero .store-links { justify-content: center; }
        .product-stage { min-height: 690px; }
        .promise-inner { flex-wrap: wrap; padding: 27px 0; row-gap: 13px; }
        .step-grid { grid-template-columns: 1fr; }
        .step { min-height: 210px; }
        .showcase-card { grid-template-columns: 1fr; padding: 62px 42px 0; }
        .showcase-copy { max-width: 580px; }
        .showcase-visual { margin-top: 30px; }
        .open-source-card { grid-template-columns: 1fr; gap: 28px; }
        .repo-button { justify-self: start; }
      }
      @media (max-width: 600px) {
        .shell { width: calc(100% - 32px); }
        .nav { height: 68px; }
        .brand { gap: 9px; font-size: 19px; }
        .brand-mark { width: 32px; height: 32px; border-radius: 10px; font-size: 18px; }
        .nav-links { gap: 0; }
        .nav-links > a:not(.nav-cta) { display: none; }
        .nav-links .nav-cta { padding: 10px 14px; font-size: 13px; }
        .hero { gap: 28px; min-height: auto; padding: 38px 0 64px; text-align: left; }
        .eyebrow { margin-bottom: 20px; }
        h1 { font-size: clamp(46px, 13.4vw, 58px); line-height: .97; letter-spacing: -.062em; }
        .hero-copy > p { margin: 22px 0 26px; font-size: 17px; line-height: 1.5; }
        .hero .store-links { justify-content: flex-start; gap: 4px; }
        .app-store-badge { height: 48px; }
        .google-play-badge { height: 70px; margin: -11px -10px; }
        .hero-note { margin-top: 16px; line-height: 1.45; }
        .product-stage { min-height: 500px; width: 100%; overflow: hidden; transform: none; margin: 0; border-radius: 34px; }
        .product-stage::before { width: 92%; }
        .product-stage::after { inset: 7% 0; }
        .device { padding: 5px; border-radius: 40px; }
        .app-preview-image { border-radius: 35px; }
        .hero-device { width: 232px; transform: rotate(-3.5deg) translateX(-39px); }
        .hero-stats-device { width: 158px; right: 3px; bottom: 28px; transform: rotate(5deg); }
        .promise-inner { min-height: 116px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px 12px; padding: 22px 0; justify-items: start; }
        .promise-inner span { white-space: normal; text-align: center; }
        .promise-inner span::after { display: none; }
        .steps { padding: 68px 0 88px; }
        .section-heading { margin-bottom: 34px; }
        .section-heading h2 { margin-top: 12px; font-size: 42px; }
        .step-grid { gap: 12px; }
        .step { min-height: 190px; padding: 23px; border-radius: 22px; }
        .step h3 { font-size: 22px; }
        .showcase { padding-bottom: 80px; }
        .showcase-card { min-height: 0; padding: 43px 24px 0; border-radius: 28px; }
        .showcase-copy h2 { margin-top: 14px; font-size: 40px; }
        .showcase-copy p { font-size: 16px; }
        .showcase-visual { height: 410px; width: 100%; margin: 26px 0 0; }
        .showcase-device { width: 184px; }
        .showcase-group-device { left: -12px; top: 48px; transform: rotate(-4deg); }
        .showcase-statistics-device { width: 154px; right: -7px; top: 4px; transform: rotate(4deg); }
        .open-source { padding: 72px 0 0; }
        .open-source-card { gap: 24px; padding: 30px 23px; border-radius: 24px; }
        .open-source-copy h2 { font-size: 30px; }
        .collaborator-list { flex-direction: column; align-items: flex-start; }
        .repo-button { justify-self: stretch; }
        .cta { padding-bottom: 72px; }
        .cta-inner { padding: 68px 20px; border-radius: 28px; }
        .cta h2 { font-size: 44px; }
        .cta .store-links { flex-direction: column; gap: 0; }
        .cta .google-play-badge { margin-top: -9px; margin-bottom: -9px; }
        .footer-inner { flex-direction: column; align-items: flex-start; gap: 18px; }
        .footer-links { flex-wrap: wrap; gap: 12px 20px; text-align: left; }
      }
      @media (max-width: 370px) {
        .shell { width: calc(100% - 28px); }
        h1 { font-size: 44px; }
        .app-store-badge { height: 45px; }
        .google-play-badge { height: 65px; }
        .hero-device { width: 218px; transform: rotate(-3.5deg) translateX(-36px); }
        .hero-stats-device { width: 148px; right: 2px; }
        .showcase-card { padding-left: 20px; padding-right: 20px; }
        .showcase-copy h2 { font-size: 37px; }
        .showcase-device { width: 174px; }
        .showcase-statistics-device { width: 145px; }
      }
      @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } * { transition: none !important; } }
    </style>
  </head>
  <body>
    <header class="shell nav">
      <a class="brand" href="/" aria-label="Splidly home"><span class="brand-mark" aria-hidden="true">S</span>splidly</a>
      <nav class="nav-links" aria-label="Main navigation"><a href="#open-source">Open source</a><a href="#how-it-works">How it works</a><a href="#inside">Inside the app</a><a class="nav-cta" href="${escapeHtml(env.IOS_STORE_URL)}">Get Splidly</a></nav>
    </header>
    <main>
      <section class="shell hero">
        <div class="hero-copy">
          <div class="eyebrow"><span class="eyebrow-dot" aria-hidden="true">&#10003;</span> Shared plans, sorted</div>
          <h1>Split the cost.<br />Keep the good part.</h1>
          <p>Splidly makes shared expenses feel effortless — from weekend trips to the everyday stuff at home.</p>
          ${stores}
          <div class="hero-note">Free to start · No ads · Built for iPhone &amp; Android</div>
        </div>
        <div class="product-stage" aria-label="Splidly app preview">
          <div class="device hero-device"><img class="app-preview-image" src="/app-group-overview.png" alt="Splidly group screen showing shared expenses for a Lisbon Weekend" /></div>
          <div class="device hero-stats-device"><img class="app-preview-image" src="/app-statistics.png" alt="Splidly statistics screen showing personal share and spending over time" /></div>
        </div>
      </section>
      <section class="promise"><div class="shell promise-inner"><span>Open source</span><span>Multiple currencies</span><span>Clear for everyone</span><span>No ads</span></div></section>
      <section class="shell open-source" id="open-source">
        <div class="open-source-card">
          <div class="open-source-copy"><small>Open source</small><h2>Built in the open.</h2><p>Splidly is an open-source project. Explore the code, follow development, and help shape what comes next on GitHub.</p></div>
          <div class="collaborators"><span>Collaborators</span><div class="collaborator-list"><a class="collaborator" href="https://github.com/Florian2807" target="_blank" rel="noreferrer"><span class="collaborator-initial">F</span>Florian2807</a><a class="collaborator" href="https://github.com/LosFarmosCTL" target="_blank" rel="noreferrer"><span class="collaborator-initial">L</span>LosFarmosCTL</a></div></div>
          <a class="repo-button" href="https://github.com/LosFarmosCTL/splidly" target="_blank" rel="noreferrer">View repository&nbsp; ↗</a>
        </div>
      </section>
      <section class="shell steps" id="how-it-works">
        <div class="section-heading"><small>How it works</small><h2>Less math. More memories.</h2></div>
        <div class="step-grid">
          <article class="step"><div class="step-number">01</div><h3>Create a group</h3><p>Bring everyone into one shared space for the trip, home, event, or plan.</p></article>
          <article class="step"><div class="step-number">02</div><h3>Add what you spend</h3><p>Choose who paid and split it equally, by amount, or however feels fair.</p></article>
          <article class="step"><div class="step-number">03</div><h3>Settle, simply</h3><p>See who owes what at a glance and record it when the money is settled.</p></article>
        </div>
      </section>
      <section class="shell showcase" id="inside">
        <div class="showcase-card">
          <div class="showcase-copy"><small>Everything in view</small><h2>Clear enough for everyone.</h2><p>Every expense, balance, and settlement stays easy to follow. Even when the group gets busy.</p></div>
          <div class="showcase-visual" aria-label="The real Splidly group interface">
            <div class="device showcase-device showcase-group-device"><img class="app-preview-image" src="/app-group-overview.png" alt="Splidly group activity with balances and shared expenses" /></div>
            <div class="device showcase-device showcase-statistics-device"><img class="app-preview-image" src="/app-statistics.png" alt="Splidly statistics with personal share, spending over time, and category totals" /></div>
          </div>
        </div>
      </section>
      <section class="shell cta"><div class="cta-inner"><h2>Ready to make it easy?</h2><p>Start your first group in a minute.</p>${stores}</div></section>
    </main>
    <footer><div class="shell footer-inner"><span>© 2026 Splidly</span><div class="footer-links"><a href="https://github.com/LosFarmosCTL/splidly" target="_blank" rel="noreferrer">GitHub</a><a href="/privacy">Privacy</a><a href="/account/delete">Delete account</a><a href="mailto:hello@splidly.site">Contact</a></div></div></footer>
  </body>
</html>`;
}

export function invitePage(token: string, env: Env): string {
  const safeToken = escapeHtml(token);
  return documentLayout(
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
  return documentLayout(
    "Privacy · Splidly",
    `<h1>Privacy Policy</h1>
     <p><small>Effective July 31, 2026</small></p>
     <p>Splidly is a shared-expense ledger. It records who paid, how a cost was split, and the settlements people record themselves. Splidly does not move money, show advertising, sell personal data, or use personal data for advertising tracking.</p>

     <h2>Data Splidly collects</h2>
     <ul>
       <li><strong>Account and profile data:</strong> the account identifier, name, email address, and profile-image URL provided by Apple or Google; your display name, home currency, and profile picture you choose; and authentication tokens needed to keep you signed in.</li>
       <li><strong>Shared-ledger data:</strong> friendships, groups and memberships, group pictures, invitations, expense descriptions and notes, dates, amounts, currencies, payers, splits, exchange-rate snapshots, settlements, and the resulting ledger history.</li>
       <li><strong>Security and session data:</strong> session identifiers and expiry times, IP address, and user-agent information used to authenticate requests and protect the service.</li>
       <li><strong>On-device data:</strong> the app stores session credentials, pending invitation details, and recently selected currencies in protected device storage.</li>
     </ul>
     <p>Names, profile and group pictures, expense details, notes, balances, and settlements are visible to the other people who participate in the applicable friendship or group.</p>

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
     <p>You can edit or remove your profile picture, display name, and home currency; edit or remove a group picture while you are a member; sign out; or start account deletion from Profile. You can also revoke Splidly’s access through your Apple or Google account settings. For access, correction, a portable copy of your data, or another privacy request, email <a href="mailto:privacy@splidly.site">privacy@splidly.site</a>.</p>

     <h2>Security</h2>
     <p>Splidly uses HTTPS in transit, protected device storage for session credentials, and access controls for servers, databases, and backups. No internet service can guarantee absolute security.</p>

     <h2>Changes and contact</h2>
     <p>This policy may be updated when Splidly’s features or providers change. Material changes will be reflected here with a new effective date. Splidly is operated by the developer identified on its App Store listing. Privacy questions can be sent to <a href="mailto:privacy@splidly.site">privacy@splidly.site</a>.</p>`,
  );
}

export function deletionPage(signedIn: boolean): string {
  if (signedIn) {
    return documentLayout(
      "Delete account · Splidly",
      `<h1>Delete your account</h1>
       <p>You must settle all balances and leave every group first. Your identity and provider sessions will be removed; anonymized shared ledger facts remain for other participants.</p>
       <form method="post"><input type="hidden" name="confirmation" value="DELETE" /><button class="button danger" type="submit">Permanently delete account</button></form>`,
    );
  }
  return documentLayout(
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
  return documentLayout(
    success ? "Account deleted · Splidly" : "Could not delete · Splidly",
    success
      ? `<h1>Account deleted</h1><p>Your Splidly identity and sessions have been removed.</p>`
      : `<h1>Account not deleted</h1><p>${escapeHtml(message ?? "Please settle balances and leave groups, then try again.")}</p>`,
  );
}

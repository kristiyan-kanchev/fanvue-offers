# Engineering notes

The detail behind the [README](../README.md).

## Setting up live mode

1. Create an app in the Fanvue developer area. Only creators who have passed KYC can do this.
2. Request exactly these scopes, and tick the same ones in the developer area:
   `read:self read:creator write:creator read:insights read:fan read:chat write:chat`.
   The starter adds `openid`, `offline_access` and `offline` itself, which is what makes refresh
   tokens work.
3. Set the redirect URI to `https://<your-host>/api/oauth/callback`. Fanvue requires HTTPS even
   locally.
4. Optional: set `LLM_MODEL`, `LLM_API_KEY` and `LLM_BASE_URL` for drafted messages. Any
   OpenAI-compatible endpoint works. `.env.example` has the OpenRouter values.
5. In production, add an Upstash Redis database for the drafting budget and the history (below).

### The shared store

Three things need state that every server instance agrees on: the drafting budgets (so the
public demo can't run up the model key), the send lock, and the log of fixes sent, for **History**.
All three live in Upstash Redis, reached over its REST API with plain `fetch` (`src/lib/store.ts`). Add it from
the Vercel dashboard (Storage, then Upstash Redis): that sets `KV_REST_API_URL` and
`KV_REST_API_TOKEN`. A database made on upstash.com works too, with `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN`.

- **Locally**, without those, both use an in-memory map.
- **In production without them**, drafting falls back to the built-in wording rather than give
  each server instance its own budget, and **History** says what you send isn't being saved.
- **The budgets** are counters that open with the first draft and expire an hour later (`INCR`,
  then `EXPIRE … NX`): one shared by the whole demo, and one per connected creator.
  `LLM_HOURLY_LIMIT` sets their size (default 3). Any store error counts as "no budget". The AI
  SDK's retries are off, so one draft spent is one call made. A draft is cached for that hour, keyed on the model, the instructions
  and the facts, so opening a fix again shows it again for free. **Write another version** always
  spends.
- **The log of fixes sent** is one hash per creator: each fix sent, keyed by its mass message id. No message
  text and nothing about a fan. Results come from a fresh read of Fanvue. Because Fanvue only
  lists active promotions, the last redemption count seen is written back, so a result outlives
  its offer.

### HTTPS in local development

Fanvue will not redirect to a plain HTTP URL, so live mode needs a trusted local certificate.
Either option works:

```bash
# Option A: portless (stable named .localhost URLs, certs handled for you)
npm install -g portless
portless proxy start --https
# then run: portless run next dev

# Option B: mkcert + local-ssl-proxy
brew install mkcert && mkcert -install
mkcert offer-ladder.dev
echo "127.0.0.1 offer-ladder.dev" | sudo tee -a /etc/hosts
npx local-ssl-proxy --source 3001 --target 3000 \
  --cert ./offer-ladder.dev.pem --key ./offer-ladder.dev-key.pem
```

Set `OAUTH_REDIRECT_URI` and `BASE_URL` to match whichever option you pick.

### Why `read:chat`, when the app never reads a chat

`GET /chats/lists/smart` and `GET /chats/mass-messages` both require `read:chat`, and they are
the only reason the app asks for it. No code path fetches a conversation. From mass messages the
app keeps the counts and which smart lists each one went to. It also passes the text of the
creator's last three broadcasts to the drafting model as voice examples. That is the creator's
own writing, never a fan's. The landing page says all of this in plain words, under
**What we access**, as App Store listing rule 1.5 asks.

## How it is built

Next.js App Router, TypeScript strict, `@fanvue/ui` with Tailwind v4, the Vercel AI SDK for
drafting, and Vitest.

```
src/
  fanvue/
    schema.d.ts        generated from Fanvue's openapi.json, never hand-written
    typed.ts           path-typed get/post: response, query and body come from the schema
    client.ts          fetch wrapper: version header, auth refresh, one 429 retry, typed errors
    constants.ts       the API version and the access summary: safe to import from the browser
    server-client.ts   a client for the live session, and the rare 401 on a good-looking token
  data/
    types.ts           CreatorSnapshot and the types derived from the schema
    get-source.ts      live or demo behind one interface, or NotConnectedError
    live-source.ts     every read, in parallel; a failed read marks its rung unavailable
    shapes.ts          every answer checked against the fields the rules read
    fixture-source.ts  the same interface over the demo creators, plus the demo's dry runs
  audit/
    rules/             pure rules, one file per rung, thresholds as named constants
    story.ts           the rules in a creator's words: one card per thing you can fix
  actions/
    approaches.ts      the ways to fix each problem: an offer (or none) and a message angle
    plan.ts            one plan shape and builder; the only place a fix becomes a request body
    execute.ts         the offer (if any), then the message
    guards.ts          one message a week per list; no resend for an offer that is gone
    send-checks.ts     the whole "may this be sent" question, for the route and for the page
    send-lock.ts       the five-minute lock on one creator and one list
    message-check.ts   what a message claims about money off and free days
    registry.ts        server-side validation of approach, offer and date, then drafting
    draft-copy.ts      the built-in wording for each approach, and the prompt the model writes from
    draft-message.ts   the model call behind the hourly budget
    draft-budget.ts    the hourly counter: one for the demo together, one per creator
    setup.ts           the welcome flow's three calls: price, welcome message, trial link
  history/
    history.ts         the log of fixes sent turned into rows, totals and money
    log.ts / demo.ts   where the rows come from: the store, or the demo's own past
  server/
    load-audit.ts      what the overview and the fix page need, in one read
    load-history.ts    the fixes sent, with their results, for the overview's History list
    theme.ts           the light or dark class, from a cookie or the browser's colour-scheme hint
    attempt.ts         runs a read and turns a failure into words a page can show
    http.ts            those words, and the JSON error shape the API routes use
  lib/
    store.ts           Upstash Redis over REST, or an in-memory map locally
    session.ts         the encrypted cookie: read it, start it, clear it
    session-token.ts   sealing and opening that cookie, with no Next.js request APIs in it
    oauth.ts           the token exchange, and revoking the login on Disconnect
    token-refresh.ts   refreshes a minute early, and shares one result per minute
    api.ts / format.ts / theme.ts
  app/
    page.tsx           landing; audit/, fix/[kind]/, welcome/ are the pages
    actions.ts         server actions: start the demo, leave, and Check again
    error.tsx          the last resort, for a bug: pages turn Fanvue failures into their own message
    api/               the routes that are left: oauth login and callback, setup/[step],
                       actions/[kind] (send) and actions/[kind]/plan (draft)
  components/          the UI, server-rendered except where it holds state
  proxy.ts             refreshes tokens and turns away cross-site writes
```

**Pages are server components; writes are server actions.** `app/actions.ts` holds the three writes
that are just "do this, then show me the page again": starting the demo, leaving it, and **Check
again**, which re-reads Fanvue past its minute-long cache. Each page loads its own data on the
server (`load-audit.ts`) instead of fetching it from the browser, so nothing
about a creator crosses the wire twice, and a failed read becomes a sentence from `attempt()`
rather than a thrown message. The fix flow is the exception: it needs a JSON answer while the
creator is still on the page, so it posts to `/api/actions/[kind]/plan` to draft and
`/api/actions/[kind]` to send.

**Every call to Fanvue is typed from its path.** `getJson(client, "/promotions")` takes its
response, query and body types from the generated schema, so a wrong field, wrapper key or list id
fails `tsc`. To regenerate, run `pnpm types:fanvue`. On 23 Sept 2026 it produced no diff.

**Fanvue is the source of truth.** Whether a fix is done, and how it is doing, is read back from
Fanvue every time. The only thing the app keeps is a log of what it sent, for **History**:

- A live offer shows on its rung with Fanvue's `usedCount`.
- A message sent in the last week holds its list, whoever sent it.

In the demo, a dry run is kept in the session cookie and laid over the fixtures, so the ladder
changes exactly the way it would after a real send. Switching demo creator clears it.

### The rungs

| Rung | Fires when | Severity | Fix |
| --- | --- | --- | --- |
| Way in (attraction) | followers exist, with no free trial link and no offer open to new fans | high if followers ≥ subscribers | A free trial, first month off, or a personal invite |
| Win-back (downsell) | 20+ lapsed subscribers and no offer open to them | high at 100+ | A discount, a free week back, or just an invite |
| Renewals (continuity) | over 20% of subscribers have auto-renew off | medium | A reminder, or what's coming next month |
| Renewals (continuity) | weekly churn up 2+ points on four weeks ago | high | Covered by the renewal message |

**One list, one message.** Two fixes that would message the same people collapse into one. Churn
defers to the renewal message, because the people likeliest to churn next are the ones with
auto-renew already off.

**Fans on a free trial wait.** Most trial fans have auto-renew off from the start, so a reminder
the day they join would read as a nudge to pay. When the people set to leave are mostly on a
trial, both renewal rules hold the message until three days before the earliest a running trial
can end. Fanvue doesn't say when each fan started, so that's worked out from the trial offers'
own dates, and the overview says when the reminder is due.

**The order is severity first, then money.** Severity says how sure the rules are that money is
leaving. Ranking on money alone would put a weak renewal ask above a win-back, just because more
people are behind it.

**Money figures are only shown where they are honest:**

- **Churn** uses Fanvue's own `revenueLost`.
- **Renewals switched off** are count × price, because that money really does stop unless the
  fan acts.
- **The win-back and the way in** show the price per person and never a total. A total would need
  a return or conversion rate that nobody has measured.

### Approaches

A problem is not one fix. `approaches.ts` lists two or three per problem. Each is an offer (a
discount, a free trial, or none) for the group that problem is about, plus the angle its message
takes. Renewal approaches never have an offer, because no promotion group reaches subscribers
whose auto-renew is off. The registry rejects an approach from another problem, and an offer value
outside Fanvue's range, before anything is built.

Two approaches, "just invite them back" and "tell them what's coming", depend on something only
the creator knows. Their message carries a `[placeholder]`, and Send is disabled until it is
replaced. Send is also disabled when the message names a percentage or a number of days that
differs from the offer.

The renewal fix can also switch on Fanvue's automated message for `subscription_canceled`
(a subscriber turning off auto-renew), with the same text, so every future reminder sends
itself. That call runs after the message and never fails the fix: if it doesn't stick, the
reminder has still gone out and the screen says so.

### Sending a fix

1. The fix flow shows the drafted message, with the exact request bodies one click away under
   **What gets sent to Fanvue**. The screen and the server build the bodies with the same
   `stepsFor`, and a test checks that they match for every approach.
2. The send route re-reads Fanvue fresh. It re-derives the recipients from that read (never from
   the browser), checks the message against the offer, and refuses if the list was messaged in
   the last week or the fix no longer needs doing. Offer values must be one the page offers, and
   the end date can't run past the approach's window.
3. It takes a lock on that creator and list (`SET NX EX`, five minutes), so a second tab can't
   send at the same moment. Fanvue has no idempotency key for promotions, so this is what stops
   a duplicate offer. The lock is dropped on failure and kept on success.
4. It creates the offer, then sends the message with an idempotency key.
5. If the offer was created but the message failed, the result screen offers **Try sending again**.
   The route allows it only while a fresh read still shows the offer live, and reuses the same key.

## Where this departs from the original design spec

- **A small store, not a database.** **History** reads a log of what was sent, in Upstash Redis;
  every result on it is read from Fanvue.
- **No paid-message fix.** It was the only fix that needed the vault, a media picker and price
  editing. The upsell rung is left out too, along with the earnings read it needed: advice the
  app can't act on only adds reading.
- **No "reading your account" screen.** The overview waits for its read, and the fix
  page shows a plain loading state while the first draft is written.
- **The theme is rendered by the server, not a script.** Fanvue's tokens switch on a `dark` class,
  so the layout renders it from a `theme` cookie, or on a first visit from Chromium's
  `Sec-CH-Prefers-Color-Scheme` hint (dark where there's no hint). React owns the class, so it
  survives every re-render. Light mode lifts four Fanvue tokens to WCAG AA in `globals.css`.
- **Fixtures are typed `.ts` modules, not `.json`.** `satisfies` cannot check enums through a JSON
  import, because TypeScript widens the string literals and the check silently does nothing.
- **The subscription price comes from `GET /users/account`**, the only read that carries it.

## Testing

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build      # stop pnpm dev first: they share .next
```

The tests cover:

- every rule firing and not firing, and the ordering
- one list, one message, and the one-week hold
- the demo's dry runs closing the loop
- every plan builder, and the send path (including a message-only resend that never makes a
  second offer)
- the panel of request bodies the fix flow shows matching what the server sends
- drafting without a model, and the voice samples reaching the prompt
- the drafting budget: the limit, the hourly reset, failing closed, and reuse without spending
- the log of fixes sent: live and ended offers, money only from discounts, the totals, and the demo's past
- the client: version header, 429 retry, 401 refresh
- the session cookie: tokens unreadable in it, and a changed or foreign cookie refused
- the trial hold: the renewal reminder waits for a trial, even when churn is rising
- a contract test that checks every approach, at every offer choice, against the rules Fanvue
  states only in prose: a discount or a trial, never both; trial length 1–30 days
- what blocks Send: a number that doesn't match the offer, or an unfilled `[placeholder]`

## Data handling

- **Tokens live in an encrypted, httpOnly session cookie** (a JWE: `dir`, `A256GCM`, the key
  derived from `SESSION_SECRET`). Scripts on the page can't read it, and anyone who sees its value
  can neither read the tokens nor forge a session. **Disconnect** also asks Fanvue to revoke the
  login, so an old copy of the cookie stops working.
- **Tokens are refreshed in the proxy** (`src/proxy.ts`), before a page renders. A page render
  can't set cookies, so a token refreshed there was used once and lost, and the next request spent
  the old single-use refresh token again, which ends the login. One refresh is shared by every
  request carrying the same token for a minute.
- **Writes to the API must come from the app's own pages.** The proxy turns away a non-GET API
  request whose `Origin` (or `Sec-Fetch-Site`) is another site. The OAuth callback is exempt.
- **Security headers** in production (`next.config.ts`): a Content-Security-Policy, no framing,
  `nosniff`, a Referrer-Policy and a Permissions-Policy. The landing page shows only its own error messages,
  never text from the URL.
- **Every Fanvue answer is shape-checked** against the fields the rules read
  (`src/data/shapes.ts`), and calls time out after 15 seconds. A part that fails either is shown
  as unavailable instead of crashing the page.
- The only things written anywhere are the drafting counter, recent drafts (for an hour, so
  reopening a fix doesn't spend again), and a log of fixes sent: list, offer, date and counts.
  The log never holds message text, and nothing anywhere holds anything about a fan.
- The drafting model sees the creator's name, bio, the offer, and the text of their last three
  broadcasts. It never sees fan data or DMs. With OpenRouter, turn on zero data retention.
- Money is passed around as integer cents and shown in US dollars, the currency Fanvue quotes.
  Dates are shown in UTC, since offers close at the end of a UTC day.

## Known gaps

- **Revocation on Disconnect is best effort.** It's built to the endpoint Fanvue publishes
  (`/oauth2/revoke`), but hasn't been run against a live account yet, and leaving never waits on
  it: if Fanvue is down, the cookie is still cleared.
- **The first visit in Safari or Firefox is dark.** Only Chromium sends the colour-scheme hint the
  server reads. After one press of the theme toggle, the choice is kept.
- **The weekly guard reads the last 50 mass messages.** A creator who sends more than that in a
  week could push this app's message off the page it reads.
- **Two server instances refreshing the same token at the same instant** can still collide. It
  ends in a reconnect, never in the wrong account.

## Notes from building it

- **A client component imported a module that read server env, and every page broke.** It threw
  during module evaluation and killed hydration everywhere. The fix is the split between
  `constants.ts` and `server-client.ts`, and `server-only` now turns that mistake into a build error.
- **A background on `<body>` hides a fixed backdrop that sits at a negative z-index.** The canvas
  is `<html>`'s background. With none there, `<body>`'s was propagated to it and painted behind
  everything, which is why the landing backdrop worked at all. Giving `<html>` one for Safari's
  bars turned `<body>`'s into an ordinary box, painted over the backdrop and everything below it.
  The page colour belongs on `<html>` alone.
- **Next 16 won't serve its dev resources to a host it doesn't recognise.** The page looks like
  it works but ignores every click. `allowedDevOrigins` fixes it.
- **Vitest owns `BASE_URL` inside its workers,** so env validation failed on import. The Vitest
  config sets it explicitly.
- **`next build` and a running `next dev` share one `.next` directory.** Building while the dev
  server is up leaves it serving stale pages with no error anywhere. The same thing happens when
  a long-running dev server outlives large deletions. Restart it and the stale hydration errors go.
- **The AI SDK's default OpenAI model uses the Responses API,** which OpenRouter and most
  OpenAI-compatible endpoints don't implement. Drafting calls `provider.chat()` explicitly.

## Deploying

Vercel, deployed from `main` on every push. Set the same environment variables, point
`BASE_URL` and `OAUTH_REDIRECT_URI` at the production host, add that redirect URI to the Fanvue
app, and add the Upstash store. Mark `LLM_API_KEY` and `OAUTH_CLIENT_SECRET` as sensitive.

Docs: [Fanvue API](https://api.fanvue.com/docs)

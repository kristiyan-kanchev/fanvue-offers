# Offers

A Fanvue app that shows a creator where they're losing money, and fixes it in two minutes.

**Live:** [offers-creators.vercel.app](https://offers-creators.vercel.app). Press **Try the demo**,
or connect a Fanvue creator account.

Open it and it says, in plain words, something like *"You're missing out on money in three
places."* Each place is one card:

1. **178 fans who used to pay you have left.** Fix: offer them a discount to come back, and
   message them.
2. **2,156 people follow you but don't subscribe.** Fix: give them a free trial, and message
   them.
3. **358 subscribers are set to leave.** Fix: send a friendly reminder to turn auto-renew back
   on.

Pressing **Fix this** walks through three steps: the problem, **how you want to fix it**, and
the message, previewed exactly as a fan will see it and written in the creator's voice. Then send.
Afterwards the fix moves to **History** on the same page, newest first, with what it has done so
far: *"17 fans came back · US$118.83 so far"*. It only counts money it can stand behind. A
discount is money in (each fan paid the discounted month), and a free trial is only "worth US$X/mo
if they stay". Offers or reminders set up in Fanvue directly show there too. **Check again** reads
the results from Fanvue fresh.

Every problem has more than one fix, because creators differ:

| Problem | Ways to fix it |
| --- | --- |
| Fans who left | A discount to come back · A free week back · Just invite them back (no discount) |
| Followers who don't subscribe | A free trial · Money off the first month · A personal invite (no offer) |
| Subscribers set to leave | A friendly reminder · Tell them what's coming next month, and optionally send it automatically to anyone who turns off auto-renew from now on |

Each one is a combination Fanvue's API supports: an offer (a discount, a free trial, or none) plus
a message written for that angle. One is recommended from the data. If fans left over price, a
discount comes first. Approaches that need something only the creator knows ("what's coming next
month") leave a `[gap]` in the message, and Send stays locked until they fill it in, so nothing
made up gets sent.

The idea comes from Alex Hormozi's money models (a way in, a reason to come back, a reason to
stay). The app never uses those words, because creators don't.

## Try it

```bash
pnpm install
pnpm dev
```

Open the app and click **Try the demo**. No Fanvue account or API key is needed.
Press **Fix this** on the first card and go through to the send. Nothing is really sent,
but the overview updates exactly as it would after a real send. Pick **Brand new account** from
the **Demo** menu for the welcome flow a creator with no fans gets: set a price, turn on a welcome
message, and make a free trial link to share. Each step is one real Fanvue call on a live account.

For drafts written by a model instead of the built-in wording, set `LLM_MODEL`, `LLM_API_KEY` and
`LLM_BASE_URL`. Any OpenAI-compatible endpoint works, and `.env.example` has the OpenRouter
values. Locally the drafting budget and history live in memory; in production they need an
Upstash Redis database (see the [engineering notes](docs/engineering-notes.md#the-shared-store)).

## What makes it safe to hand to a creator

- **The numbers come from rules, not a model.** The model only drafts copy. It sees the offer and
  the creator's own recent broadcasts, and never a fan's data or DMs.
- **Nothing sends until the creator approves that exact message.** The server checks it again
  before sending: no unfilled `[gap]`, and nothing the offer doesn't give (another discount,
  "half price", free days on a discount, a different trial length, an offer when there is none).
  An AI draft that gets the offer wrong is never shown.
- **One list, one message a week.** It reads Fanvue's own record of mass messages, so this holds
  even for messages sent from Fanvue directly. A short lock means two tabs pressing Send at the
  same moment can't both get through.
- **No resend into a dead offer.** If an offer was created but its message failed, the message
  can only be resent while that offer is still live.
- **The model key can't be run up.** Every model call spends from an hourly budget counted in
  a shared store: 3 drafts an hour for everyone in the demo together, and 3 for each connected
  creator (`LLM_HOURLY_LIMIT`), so a demo visitor can't use up a real creator's drafts. Past it,
  or if the store can't be reached, the app uses its built-in wording and says so. Reopening a
  fix shows the recent draft again without spending.
- **No invented totals.** It says "Every fan who comes back is US$9.99 a month", not "US$1,778
  a month", because the total would assume every one of them comes back.

## What I left out, and why

- **Per-fan personalised DMs.** Personalising each message means reading every fan's DMs and
  turning one approved send into hundreds. That would make it a different product. It's first
  in line for v2.
- **Fixes that need more than an offer and a message**, like a paid message with vault media or
  a loyalty bonus. Every approach here is something the API can do in two calls.
- **A paid-message fix.** It needs the vault, a media picker and price editing, which is more
  than the other three fixes put together. Advice with no button beside it is just noise, so the
  upsell check went with it.
- **A real database.** The only thing kept is a small log of fixes sent (which list, which
  offer, when) and the drafting budget, in Upstash Redis. Every result is read from Fanvue, so
  nothing can fall out of sync, and nothing about a fan is ever stored.
- **Full autopilot.** Most Fanvue apps already run DMs on their own, and creators are happy with
  that. The first step is here: the renewal reminder can become Fanvue's automatic message for
  anyone who turns off auto-renew. Running whole campaigns on a schedule, or reacting to
  webhooks, needs a job runner and webhook handling. That's the natural v2.
- **Agency view, A/B variants, embedding in Fanvue.** All real, but none of them are needed to
  prove the loop.

## What is verified, and what isn't

**Verified:**

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (148 tests) and `pnpm build` all pass, and CI runs
  all four on every push. `pnpm audit` reports no known vulnerabilities.
- **An independent security, code and chaos review** (a separate agent, run against a local copy
  with a mocked Fanvue) found twelve issues, all fixed with tests: most seriously a token
  refresh that was lost during a page render, and two simultaneous sends both going out.
- **Live on a real creator account:** the Fanvue login, every read, the profile picture, and the
  whole welcome flow (price, welcome message, trial link), checked in Fanvue afterwards.
- **A fix sent for real, end to end:** a second fan account followed the creator, the free trial
  fix went out (`POST /promotions`, then `POST /chats/mass-messages`), the fan got the message and
  took the trial, and History showed the offer live with its result. That run is also where the
  trial hold below came from: a fan on a free trial usually has auto-renew off, and a reminder the
  day they join lands badly, so it now waits until a few days before the trial ends.
- Every call to Fanvue is typed from its path against the published OpenAPI spec, so a wrong
  field, wrapper or list id fails the build.
- The demo was clicked through in a browser after the cleanup: starting it, all three steps of a
  fix, the send, the result screen, **History** and **Check again**, switching to the brand new account
  from the **Demo** menu and its welcome flow, light mode (measured against WCAG AA), and
  **Exit demo**.

**Not yet:** the win-back and the renewal reminder against a live account (the win-back needs 20
lapsed subscribers), revoking the login on **Disconnect** (built to Fanvue's published revocation
endpoint), and the landing page's toolbar colour in Safari on a real phone. Here's how to repeat
the live check with an empty account and a second fan account.

### Live check with an empty account

An empty account puts every read through the real API. A second, fan account unlocks two of the
three fixes. Setup is in the [engineering notes](docs/engineering-notes.md#setting-up-live-mode).

1. **Connect.** An empty account lands in the welcome flow. Set a price, turn on the welcome
   message and make a trial link, then check each one in Fanvue: that's `PATCH
   /users/me/subscription-price`, `PUT /chats/automated-messages/new_subscriber` and `POST
   /free-trial-links`, for real.
2. **Follow the creator from the fan account, then press Check again.** A card appears: "1
   person follows you but doesn't subscribe".
3. **Fix this, then send.** The trial should appear on the creator profile, and the fan
   account should get the message. This is `POST /promotions` then `POST /chats/mass-messages`,
   for real.
4. **Back on the overview**, the fix is under **History**: "Invited followers to subscribe: 7 days
   free", marked Live, with "Nobody's used it yet".
5. **Start the trial from the fan account, then press Check again.** It reads "1 started a free
   trial".
6. **A fan on a trial has auto-renew off.** Instead of a "set to leave" card, History says "Your
   trial fan gets a reminder on …", three days before the trial can end. On that day the card
   appears; send the reminder, and it's held for a week.
7. **Clean up:** delete the promotion in Fanvue.

The win-back needs 20 or more lapsed subscribers, so it can't be tested this way. It uses the same
send path as step 3, and a contract test checks every approach's request body at every offer
choice. "A free week back" (a free trial offered to fans who left) is allowed by Fanvue's spec but
hasn't been sent against a live account yet.

## More

[docs/engineering-notes.md](docs/engineering-notes.md) covers live setup, the architecture, how a
fix is sent, where the build departs from the original spec, data handling, and what went wrong
while building it.

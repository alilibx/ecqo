# Baileys Anti-Ban Research

Deep technical research into every known technique for making Baileys (WhatsApp Web unofficial library) resistant to account bans. Compiled March 2026.

---

## 1. baileys-antiban Library

**Repository:** [kobie3717/baileys-antiban](https://github.com/kobie3717/baileys-antiban) (20 stars)

### What It Does

A middleware wrapper for Baileys that intercepts `sendMessage` calls and applies human-behavioral patterns before allowing them through.

### Core Strategies

**Gaussian-distributed delays** — Instead of uniform random delays (which are statistically detectable), it uses a normal distribution centered around natural human typing speeds (~30ms/character). This is the single most important technique: WhatsApp's behavioral analysis almost certainly uses statistical tests on inter-message timing.

**Rate limiting with burst allowance:**
- Default: 8 msgs/min, 200/hour, 1500/day
- Min/max delay: 1500-5000ms between messages
- New chat penalty: +3000ms for first message to unknown recipient
- Identical message cap: 3 before blocking (WhatsApp detects duplicate content)

**7-day warm-up phase:**
- Day 1: 20 messages max
- Growth factor: 1.8x daily (so ~36, ~65, ~117, ~210, ~378, ~680)
- Re-enters warm-up after 72 hours of inactivity

**Health monitoring (risk scoring 0-100):**
- Frequent disconnects: +15 to +30 per event
- 403 Forbidden: +40 per event (strong ban signal)
- 401 Logged Out: +60 per event (critical)
- Failed messages: +20 per event
- Auto-pause at configurable risk threshold

**Content variation:** Zero-width character injection, punctuation variation, and synonym replacement to defeat identical-message detection.

**Time-aware scheduling:** Timezone-aware active hours, weekend slowdowns, lunch break simulation.

### Assessment

The library addresses the *behavioral* layer of detection well but does **nothing** about the *protocol* layer (WAM telemetry, prekey rotation, browser fingerprinting, etc.). It's a necessary but insufficient component.

---

## 2. WhatsMeow vs Baileys

### Key Differences

| Aspect | Baileys | WhatsMeow |
|--------|---------|-----------|
| Language | TypeScript/Node.js | Go |
| Maintainer | Community (WhiskeySockets) | tulir (mautrix bridge author) |
| WAM telemetry | Partial (initial value on connect) | Recently added unified_session telemetry (PR #1057) |
| Keepalive | Fixed 30s interval | Randomized 20-30s interval |
| Production use | Varied quality | Powers mautrix-whatsapp (since 2018) |

### WhatsMeow's Advantages

1. **unified_session telemetry** (PR #1057): Implements WhatsApp's session tracking mechanism. Session ID = `(current_time_ms + 3_days) % 7_days`. Sends at: login success, pairing completion, and presence broadcast. Users reported: "Before that some numbers were getting banned just by connecting... After deployment, didn't get any bans."

2. **Server time synchronization**: Extracts the `t` attribute from the CB:success connection node to calculate server time skew. Session IDs must align with server expectations or the client is flagged as non-official.

3. **Randomized keepalive intervals**: 20-30 second range with jitter (see `keepalive.go`), vs Baileys' fixed 30-second `setInterval`. A fixed interval is a trivial statistical fingerprint.

4. **Mature Signal protocol implementation**: Fewer Bad MAC / prekey errors in production.

5. **Single dedicated maintainer** (tulir) who also maintains the largest WhatsApp bridge in production (mautrix-whatsapp, running since August 2018).

### WhatsMeow's Disadvantages

- Go, not JS/TS (harder to integrate with Node.js services)
- WAM implementation is still described as "mostly behavioral, not WAM" by maintainer
- Same fundamental detection surface as Baileys

### Verdict

WhatsMeow has a modest edge in ban resistance due to better telemetry and keepalive handling, but both libraries face the same core problem: WhatsApp's detection is increasingly behavioral, not just protocol-based.

---

## 3. PreKey Rotation

### The Problem

The Signal protocol specifies that clients should periodically rotate their **signed prekey** (typically every 2-7 days in the official client). Baileys generates a signed prekey at registration time and **never rotates it**. This is a detectable anomaly: WhatsApp's server can observe that a linked device has used the same signed prekey ID for months.

### "Prekey Pogo" Paper

Despite references in community discussions, I could not locate this paper in IACR ePrint, USENIX, IEEE S&P, or arXiv. It may be: (a) a conference talk rather than a published paper, (b) circulated under a different title, or (c) a community-coined name for the general observation that unofficial clients don't rotate prekeys.

### Current State in Baileys

The `pre-key-manager.ts` manages prekey **deletion** (consumption after first use) with concurrency controls, but there is no scheduled **rotation** of the signed prekey.

In `validate-connection.ts`, the `generateRegistrationNode` sends the `signedPreKey` from `SignalCreds` during registration. This key is generated once in `initAuthCreds()` and stored in `AuthenticationCreds`. It is never replaced.

PR #2372 adds a 5-minute grace period before prekey deletion (to handle retransmissions) and fixes LID migration races, but does **not** address signed prekey rotation.

### How to Fix

To implement signed prekey rotation:

1. **Track signed prekey age** in `AuthenticationCreds` (add `signedPreKeyTimestamp`)
2. **On connection**, check if age > N days (WhatsApp Web appears to rotate every ~2-7 days)
3. **Generate new signed prekey**: `signedKeyPair()` from `crypto.ts`, increment `signedPreKeyId`
4. **Upload to server** via the same IQ mechanism used during registration (`xmppSignedPreKey`)
5. **Keep the old key** for a grace period (messages in flight may still use it)
6. **Persist** the new key and timestamp

No fork currently implements this. It would be a significant anti-detection improvement because it's a **server-observable** anomaly, unlike behavioral patterns which require statistical analysis.

---

## 4. Browser Fingerprint Spoofing

### What Baileys Sends

From `browser-utils.ts`:

```typescript
export const Browsers: BrowsersMap = {
  ubuntu: browser => ['Ubuntu', browser, '22.04.4'],
  macOS: browser => ['Mac OS', browser, '14.4.1'],
  baileys: browser => ['Baileys', browser, '6.5.0'],
  windows: browser => ['Windows', browser, '10.0.22631'],
  appropriate: browser => [PLATFORM_MAP[platform()] || 'Ubuntu', browser, release()]
}
```

Default is `Browsers.macOS('Chrome')` which sends `['Mac OS', 'Chrome', '14.4.1']`.

### What WhatsApp Sees

In `validate-connection.ts`, the browser tuple maps to:
- `DeviceProps.os` = browser[0] (e.g., "Mac OS")
- `DeviceProps.platformType` = mapped from browser[1] (e.g., CHROME)
- `UserAgent.Platform` = WEB (hardcoded)
- `WebInfo.WebSubPlatform` = DARWIN or WIN32 (if syncFullHistory + Desktop)

### Does It Matter?

**Yes, significantly.** PR #2393 reveals that:
- Sending `Platform.WEB` with mismatched `DeviceProps` can trigger 405 errors
- Android registration requires `UserAgent.Platform = MACOS (24)` for the handshake but `DeviceProps.PlatformType = ANDROID_PHONE (16)` for registration
- The platform sent during pair code flow matters: wrong values cause server timeouts

### Recommendations

1. **Never use `Browsers.baileys()`** — it literally identifies as "Baileys"
2. **Use `Browsers.macOS('Desktop')` or `Browsers.windows('Desktop')`** — these trigger the `WebSubPlatform.DARWIN` / `WIN32` paths which mimic the official WhatsApp Desktop app
3. **Don't rotate browser strings** — a real user doesn't change their OS between sessions. Stick with one consistent identity.
4. **Match your deployment OS** — if running on Linux, `Browsers.macOS()` is fine (the server can't verify your actual OS), but be consistent.

---

## 5. Protocol Version Management

### The Version Number

Baileys stores the WhatsApp Web version in `src/Defaults/baileys-version.json`:
```json
{"version": [2, 3000, 1033846690]}
```

This is sent during the handshake. An outdated version number can trigger 405/403 errors.

### Auto-Update System (PR #2324)

Baileys now has an automated version detection system:
- **Schedule**: Daily at 06:00 UTC (when WhatsApp typically deploys)
- **Primary source**: Scrapes `https://web.whatsapp.com/sw.js` (service worker)
- **Fallback**: Scrapes `https://web.whatsapp.com/` bootstrap page
- **Retry**: 3 attempts per source with exponential backoff
- **Auto-merge**: Creates PR, enables squash auto-merge when CI passes

### DIY Version Detection

If you need to stay current without waiting for Baileys releases:

```typescript
// Fetch current version from WhatsApp's service worker
const res = await fetch('https://web.whatsapp.com/sw.js');
const text = await res.text();
// Parse the version array from the JS bundle
const match = text.match(/version:\s*\[(\d+),\s*(\d+),\s*(\d+)\]/);
```

### Recommendation

Pin to the latest Baileys release and update promptly when new versions ship. The automated version system (PR #2324) means the repo stays current within 24 hours of WhatsApp deployments. For production, consider running your own version check on a cron.

---

## 6. Connection Pattern Normalization

### Heartbeat / Keepalive

**Baileys default**: Fixed 30-second `keepAliveIntervalMs` (from `DEFAULT_CONNECTION_CONFIG`).

**WhatsMeow**: Randomized 20-30 second interval using `rand.Int64N()` — significantly better.

**Real WhatsApp Web**: Observed heartbeat intervals are in the 20-30 second range with natural jitter. The official client does NOT use a fixed interval.

**Fix for Baileys**: Override `keepAliveIntervalMs` with a custom implementation that varies the interval:
```typescript
// Instead of fixed 30s, use randomized interval
const jitteredInterval = 20000 + Math.random() * 10000; // 20-30s
```

PR #2405 improved keepalive by replacing `setInterval` with recursive `setTimeout` and adding zombie socket detection (3 consecutive failures = disconnect, hard timeout at 2x interval + 5s).

### Session Duration Patterns

Real WhatsApp Web users:
- Keep sessions open for hours (tab open in browser)
- Disconnect when laptop sleeps / browser closes
- Reconnect with gaps (morning, after lunch, evening)

Bot patterns to avoid:
- 24/7 connection with zero gaps
- Instant reconnection after every disconnect
- No idle periods

### Reconnection Behavior

Real client behavior after disconnect:
1. Immediate retry (1-2 attempts)
2. Exponential backoff: 1s, 2s, 5s, 10s, 20s (from PR #2278)
3. 15% jitter factor on backoff delays
4. Eventually shows "connecting..." UI and waits for user action

Baileys PR #2278 now implements exponential backoff with `RETRY_BACKOFF_DELAYS: [1s, 2s, 5s, 10s, 20s]` and `RETRY_JITTER_FACTOR: 0.15`.

### Presence Patterns

Set `markOnlineOnConnect: false` and manage presence manually:
- Don't be "online" 24/7
- Set "available" during business hours, "unavailable" at night
- Occasional presence updates mimic real usage

---

## 7. IP Reputation

### Does WhatsApp Fingerprint by IP?

**Yes.** Strong evidence from multiple sources:

1. **Issue #225**: "Your server IP is probably blacklisted. Use another server."
2. **Issue #2359**: Specific hosting providers (Hostinger) have IPs that trigger blocks
3. **Issue #1245**: Multiple clients on same IP = instant ban (confirmed by reporter)
4. **Issue #1809**: VPS geolocation mismatch with phone location flagged
5. **Issue #2309**: Community speculates WhatsApp compares phone IP region vs web session IP region

### Datacenter vs Residential

**Datacenter IPs get flagged more aggressively.** Evidence:
- Hostinger, common VPS providers trigger faster bans
- Users report switching hosting providers resolves connection issues
- The IP-phone geolocation mismatch theory has community support

### Residential Proxies

- Users in issue #1809 suggest residential/mobile proxies to route through phone's IP
- One user tried Surfshark VPN without success (VPN IPs are also flagged)
- Residential proxy services (not VPNs) are preferred because their IPs appear in normal ISP ranges

### Recommendation

1. **Use residential IPs** in the same country/region as the phone number
2. **One account per IP** — never share IPs between bot instances
3. **Avoid known VPS providers** (AWS, GCP, Azure ranges are likely catalogued)
4. **Fly.io Machines** (your planned connector architecture) are better than big-cloud VPS but still datacenter IPs — consider proxying the WebSocket through a residential proxy service

---

## 8. Rate Limiting Patterns

### Observed Limits (from community reports)

These are approximate, community-derived values. WhatsApp does not publish official limits for unofficial clients.

| Metric | Conservative | Moderate | Aggressive (risky) |
|--------|-------------|----------|-------------------|
| Messages/minute | 3-5 | 5-8 | 8+ (ban risk) |
| Messages/hour | 30-50 | 50-100 | 100+ (ban risk) |
| Messages/day | 200-500 | 500-1000 | 1000+ (ban risk) |
| New contacts/day | 10-20 | 20-50 | 50+ (high ban risk) |
| Group messages/day | 50-100 | 100-200 | 200+ (ban risk) |

### Specific Triggers Identified

- **429 errors**: Occur at ~3 messages/second (issue #1248)
- **New chat penalty**: First message to unknown contact carries extra risk (issue #1983)
- **Forwarding limit**: >5 forwards to different chats triggers detection (issue #1901)
- **Group operations**: Bulk add/remove/settings changes are highly flagged (issue #1869)
- **Status uploads**: Rapid sequential status posts trigger bans (issue #2309)
- **Identical content**: 3+ identical messages in succession flagged (baileys-antiban default)

### Key Insight

WhatsApp's rate limiting is **not just per-minute**. It uses a composite scoring system considering:
- Message velocity (per-second, per-minute, per-hour, per-day)
- Contact novelty (new vs existing conversations)
- Content similarity
- Operation type (message vs group admin vs status)
- Account age and history

---

## 9. Account Warming

### Recommended Schedule

Based on baileys-antiban defaults and community experience:

| Day | Max Messages | Activities |
|-----|-------------|------------|
| 0-2 | 0 | Register number, let it exist. Do NOT connect Baileys yet. |
| 3-4 | 0 (manual only) | Use the number manually on a real phone. Text friends/family. Join a few groups. |
| 5 | 10-20 | Connect Baileys. Send to known contacts only. Read-only mode preferred. |
| 6-7 | 20-40 | Gradually increase. Still known contacts only. |
| 8-14 | 40-100 | Begin new contacts cautiously. 5-10 new contacts/day max. |
| 15-30 | 100-300 | Normal operation with rate limiting. |
| 30+ | 300-500 | Established account. Stay within moderate limits. |

### Critical Rules

1. **Never connect Baileys to a brand-new number** — warm up manually first for 2-4 days minimum (issue #2131: "let it chill for 2 days")
2. **After 72 hours of inactivity, re-warm** — baileys-antiban re-enters warm-up mode after 72h idle
3. **WhatsApp Business accounts** may have slightly higher tolerance but also receive more scrutiny
4. **VoIP/virtual numbers** have significantly higher ban rates than real SIM numbers (whatsmeow issue #14)

---

## 10. Read-Only vs Read-Write

### Evidence

**Read-only is NOT safe.** Multiple reports contradict the assumption that passive connections avoid detection:

1. **WhatsMeow issue #810**: "Detection occurs on idle accounts never sending messages" and "Users previously connected weeks earlier receive warnings despite no current activity"
2. **Baileys issue #1392**: Users with minimal activity (~5 messages/day) receive "account may be at risk" warnings
3. **Baileys issue #225**: Numbers banned immediately after QR scan, before any messages sent

### Why Read-Only Still Gets Flagged

WhatsApp detects unofficial clients through:
- **Protocol fingerprinting** (WAM telemetry, keepalive patterns, handshake characteristics)
- **Missing telemetry events** (official clients send WAM data; unofficial clients don't or send incomplete data)
- **Connection metadata** (IP, timing, reconnection patterns)

Merely not sending messages doesn't eliminate these signals.

### Verdict

Read-only mode reduces risk from *behavioral* detection (rate limits, spam patterns) but does **not** eliminate risk from *protocol-level* detection. You still need all the other mitigations (WAM, keepalive jitter, proper browser fingerprint, etc.).

---

## 11. Multi-Device Protocol

### Linked Device Limits

WhatsApp allows **up to 4 linked devices** per account (plus the primary phone). This limit applies to all device types: WhatsApp Web, Desktop app, and unofficial clients like Baileys.

### Detection Risk

- Each linked device session has its own Signal session keys
- Multiple linked devices from different IPs/locations is **not inherently suspicious** (people use phone + laptop + tablet)
- However, multiple linked devices from **datacenter IPs** or the **same IP** is suspicious
- Each linked device consumes a prekey set; abnormal consumption patterns are detectable

### Primary Phone Offline

- Linked devices work **independently** for up to ~14 days without the phone
- After ~14 days offline, linked devices are logged out
- Phone must periodically connect to keep linked sessions alive
- If phone is banned, all linked devices are immediately terminated

### Recommendation

For Ecqo's use case (personal assistant, one Baileys connection per user):
- **One linked device per user** is the safest profile
- Ensure the user's phone stays online (push notification to reconnect if offline too long)
- Never link multiple Baileys instances to the same account

---

## 12. Successful Long-Running Deployments

### mautrix-whatsapp (Since 2018)

The longest-running known deployment using whatsmeow. Powers Matrix-WhatsApp bridges for thousands of users. Key factors:
- Read-heavy workload (bridging messages, not bulk sending)
- Individual user sessions (each user links their own account)
- Residential IPs (users run their own bridges or use hosted services from home)
- Stays current with whatsmeow updates

### Community Reports (Issue #1869)

One user reported: "I have 28 bots running on the same server, I've never had any problems with this before!" — suggesting that for extended periods, even aggressive multi-instance setups survived. The ban wave that hit was described as affecting "millions of numbers, both bot and non-bot accounts."

Another: "My bot version 6.7.13 had been running for a year until now" — a full year before being banned.

### Common Factors in Long-Surviving Deployments

1. **Conservative rate limiting** (responding to messages, not bulk sending)
2. **Staying on stable library versions** (not bleeding edge)
3. **Residential or home-network IPs**
4. **Single account per instance**
5. **Natural usage patterns** (the bot serves a real conversational purpose)
6. **Real phone numbers** (not VoIP)

---

## 13. WhatsApp's Detection Infrastructure

### Known Detection Layers

**Layer 1 — Protocol Fingerprinting (Server-Side)**
- WAM (WhatsApp Analytics/Metrics) telemetry: Official clients send "dozens of thousands of events per day" using WAMv5 binary encoding. Missing or incomplete WAM is a strong signal.
- unified_session telemetry: Time-based session ID that must align with server clock
- tc-tokens (trusted contact tokens): Must be properly stored and sent with messages to new contacts
- Reporting tokens: Cryptographic tokens attached to eligible message types
- Signed prekey rotation: Server can observe static prekey IDs

**Layer 2 — Behavioral Analysis (Server-Side)**
- Message velocity scoring (per-second, minute, hour, day)
- Contact novelty ratio (new vs known recipients)
- Content duplication detection
- Forward/broadcast patterns
- Group operation frequency
- Time-of-day activity distribution
- Session duration and reconnection patterns

**Layer 3 — Network Fingerprinting**
- IP reputation (datacenter vs residential ranges)
- IP geolocation vs phone number country
- Multiple accounts per IP
- Connection pattern (always-on vs human-like)

**Layer 4 — User Reports**
- Other users reporting spam increases risk score
- Group admin kicks/blocks signal abuse

### ML Models (Speculated)

Based on community observation (issue #1869): "I suspect they are implementing AI to analyze and ban users, detecting the presence of bots." WhatsApp likely uses:
- Anomaly detection on messaging patterns
- Clustering of behavioral features (timing, volume, content diversity)
- Reputation scoring that accumulates over time (not binary ban/no-ban)

### The "Account at Risk" Warning

A newer detection tier (issue #1392) that warns before banning: "Recent activity indicates that your account may be using unauthorized tools." This appeared across both Baileys and WhatsMeow, suggesting it targets protocol-level signals, not just behavior.

---

## 14. Legal / ToS Angle

### WhatsApp Terms of Service

WhatsApp ToS explicitly prohibit:
- Using "automated systems" to interact with the service
- Using "any form of software or hardware that isn't authorized by us"
- Reverse engineering the service

Using Baileys is a clear ToS violation.

### EU Digital Markets Act (DMA)

**Article 7** requires gatekeepers (Meta/WhatsApp is designated) to enable messaging interoperability. However:

1. The DMA requires interoperability **through Meta's defined mechanism** — the reference implementation uses XMPP + Signal Protocol + JWT authentication, connecting to Meta's servers as a registered third-party provider
2. Third parties must **register** with Meta and comply with security requirements
3. The DMA does **not** protect unauthorized reverse-engineered clients
4. Baileys connects as a **fake linked device**, not as a DMA-compliant third-party provider
5. The interoperability obligation is for **messaging between services** (e.g., Signal users messaging WhatsApp users), not for alternative WhatsApp clients

### GDPR Data Portability

GDPR's data portability right (Article 20) allows users to export their data. WhatsApp provides a data export feature. This does **not** grant the right to maintain a persistent unauthorized connection.

### Court Cases

No known court cases protect Baileys-style usage. The closest precedent is hiQ Labs v. LinkedIn (US, web scraping), but that dealt with public data scraping, not protocol-level impersonation of an official client.

### Verdict

There is **no legal protection** for Baileys usage. The DMA interoperability angle does not apply because Baileys doesn't use the official interoperability mechanism. Using Baileys is and will remain a ToS violation with ban risk.

---

## 15. Noise Injection Techniques

### What Actually Helps

Based on community evidence and anti-ban library implementations:

**High Impact:**
- **Typing indicators before sending** — `sendPresenceUpdate('composing', jid)` with duration proportional to message length (~30ms/char). This is observable by the recipient and by WhatsApp servers.
- **Read receipts** — `readMessages([msg.key])` before replying. A bot that never reads messages but sends replies is anomalous.
- **Variable delays with gaussian distribution** — Not uniform random. Human inter-message timing follows a bell curve.
- **Message content variation** — Never send identical text to multiple recipients. Even small variations (zero-width characters, punctuation) help.

**Medium Impact:**
- **Presence updates** — Set available/unavailable at reasonable times. Don't be online 24/7.
- **Time-of-day awareness** — Reduce activity at night, peak during business hours.
- **New-chat delay** — Extra pause before first message to new contact.

**Low/Unknown Impact:**
- **Random pauses** — Adding random 1-5 second delays between operations probably doesn't hurt but evidence of benefit is anecdotal.
- **Simulating scrolling/app state** — Not possible through the WebSocket protocol; WhatsApp Web doesn't send scroll events.
- **Reading status updates** — Unclear if this helps but simulates normal usage.

### Implementation Pattern

For a conversational assistant (Ecqo's use case):

```
1. Receive message
2. Send "read" receipt (after 1-3 second delay)
3. Wait proportional to "thinking time" (2-5 seconds)
4. Send "composing" presence
5. Wait proportional to message length (~30ms/char, min 2s)
6. Send message
7. Send "paused" presence (stop typing indicator)
```

This pattern makes the bot behaviorally indistinguishable from a fast-typing human assistant.

---

## Summary: Priority-Ranked Anti-Ban Measures

For Ecqo's use case (personal WhatsApp assistant, one connection per user):

### Critical (Must Have)

1. **Latest Baileys version** — Protocol changes cause immediate bans on outdated versions
2. **Proper browser fingerprint** — `Browsers.macOS('Desktop')`, never `Browsers.baileys()`
3. **Rate limiting** — Max 5 msgs/min, 200/hour, 1000/day
4. **Account warming** — 2-4 days manual use before connecting Baileys
5. **Real phone numbers** — Never VoIP/virtual
6. **One account per IP** — Never share IPs between instances

### High Priority

7. **Keepalive jitter** — Override fixed 30s with randomized 20-30s
8. **Typing + read receipt simulation** — Full composing/read pipeline before every message
9. **Gaussian delay distribution** — Not uniform random
10. **Residential IP or proxy** — Avoid datacenter IP ranges
11. **WAM telemetry** — Ensure Baileys sends initial WAM data on connection

### Medium Priority

12. **Signed prekey rotation** — Custom implementation (no existing solution)
13. **Presence management** — Online during business hours, offline at night
14. **Content variation** — Never send identical messages to different recipients
15. **Connection pattern normalization** — Don't reconnect instantly; exponential backoff with jitter

### Low Priority / Future

16. **Protocol version auto-update** — Cron job to check WhatsApp Web version
17. **unified_session telemetry** — Implement whatsmeow-style session ID generation
18. **Health monitoring** — Track risk signals and auto-pause
19. **Consider whatsmeow** — If ban rates become unacceptable, evaluate Go-based approach

---

## Key Takeaways for Ecqo

1. **Ecqo's use case is favorable**: Personal assistant (not bulk messaging) with one connection per user on their own number is the lowest-risk Baileys profile.

2. **The biggest risk is protocol-level detection**, not behavioral: WhatsApp increasingly detects unofficial clients through missing telemetry (WAM, unified_session) and protocol anomalies (prekey staleness). Behavioral rate limiting alone is insufficient.

3. **Fly.io connector architecture is good but needs IP consideration**: Each user getting their own Fly Machine is excellent for isolation, but Fly IPs are still datacenter IPs. Consider proxying through residential proxy service.

4. **There is no silver bullet**: Even with all mitigations, WhatsApp can and does ban accounts. The user must accept this risk. Having a clear "your account was restricted" recovery flow is essential.

5. **WhatsApp is tightening enforcement**: The "account at risk" warning system (late 2025) and increasing ban waves suggest Meta is investing more in detection. The DMA does not protect unofficial clients. Plan for this getting harder, not easier.

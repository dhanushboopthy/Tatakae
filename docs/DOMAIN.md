# Free domain options (checked Oct 2026)

| Option | Cost | Setup | Good for | Watch out |
|---|---|---|---|---|
| **DuckDNS** `name.duckdns.org` | Free forever | Sign in, pick name, set IP — live in minutes | Phase 0, start today | Ugly name; can't use Cloudflare on it |
| **is-a.dev** `name.is-a.dev` | Free | Pull request to `is-a-dev/register` with a JSON file (A record → VM IP); reviewed by maintainers | Long-term personal dev domain | Review can take days; must follow their rules; on Public Suffix List |
| **eu.org** `name.eu.org` | Free | Apply at nic.eu.org, needs your own nameservers (e.g. Cloudflare free) | Real delegated domain | Approval can take weeks |
| **DigitalPlat** `*.dpdns.org`, `*.qzz.io`, `*.us.kg` | Free | Register, point NS to Cloudflare | Lets you use Cloudflare DNS/Tunnel | Newer service; stability not independently verified — keep backups of everything |
| **GitHub Student Pack** `.me` (Namecheap), `.tech`, Name.com | Free 1st year | Verify student status, claim | A real, clean domain | Renews at full price (~$20/yr for .me); turn off auto-renew if you won't pay |

**Plan (you have the GitHub Student Pack):**
1. Claim a free **.me via Namecheap** (nc.me, through the Student Pack). Prefer your name, e.g. `dhanush<x>.me`, so it doubles as your portfolio / resume domain.
2. Point the app at a subdomain: `tatakae.<yourname>.me` → A record → VM reserved IP. Keep the root free for a portfolio.
3. DNS: Namecheap's own DNS is fine. Optional: move nameservers to Cloudflare (free) for faster DNS and analytics — keep the record **DNS only (grey cloud)** so Caddy gets the Let's Encrypt certificate directly.
4. In Namecheap: turn **auto-renew off** until you decide. Renewal is ~$20/yr after year one; before expiry either pay, or move to an is-a.dev name (reinstall the PWA on each device after an address change).
5. DuckDNS only as a fallback if the claim is delayed.

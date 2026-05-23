---
title: "nag 1.0 — ok we did it."
description: "Release notes for nag 1.0 — what's in, what's out, and why there is deliberately no AI in here."
pubDate: 2026-05-22
category: "Release"
readingTime: "6 min read"
featured: true
number: "001"
---

I started building nag in early 2024 because every habit app I tried
either gamified me into anxiety or politely waited for me to remember.
I wanted something blunter — closer to the way a friend bugs you about
the gym than a productivity dashboard. Today, 1.0 is out.

This post is a brief tour of what's in the release, followed by a
proper changelog. If you're already using the beta, the short version
is: rebuilt home board, real follow-up notifications, monthly cadence,
and a much better way to handle missed days.

<div class="callout">
  <div>
    <div class="label">tl;dr</div>
    <p style="margin: 6px 0 0;">Free, no account, iOS 17+. <a href="/#get">Get it here</a>. Backups via iCloud / Drive. Data exports as JSON or CSV any time.</p>
  </div>
</div>

## What changed since the beta

The biggest visible change is the home board. The beta showed habits
as a vertical list with a tiny dot row underneath. It was fine. It also
meant you couldn't see your whole week without scrolling, and the dot
rows were too small to actually tell apart.

1.0 ships with a 2-column tile grid. Each tile is big enough to read
from across the room. The week strip lives at the bottom of every
tile, with one of seven states per day (done, today-pending,
today-done, missed, skipped, future, not-scheduled). Every state has
a distinct visual treatment so a glance is honest.

### Notifications that actually nag

The whole point of the app is the follow-up. In the beta, a "nag"
was just a second notification two hours after the first. That
worked but felt mechanical. In 1.0 each habit can opt into:

- A single reminder at your set time.
- A follow-up two hours later, with a softer tone.
- A final 9pm summary if the day still has unfinished habits.

The 9pm summary turns out to be the most useful one, by a wide margin.
It's how I ended up actually using my own software.

> "ok do it." — every notification, at some point.

### Why no AI

Two reasons. First, the value of an LLM in a habit app is mostly
suggesting habits, which is exactly the part you should write yourself.
Second, every cloud round-trip is a privacy and reliability cost I
can't justify for this product. `nag` is a local app that
nags you about local things. If that changes, I'll write a different
post.

## Full changelog

<div class="changelog">
  <div class="entry">
    <span class="tag new">new</span>
    <div>
      <strong>2-column tile home board</strong>
      <div class="body">Rebuilt from scratch. Every tile is glance-readable, with cadence, last check-in, and the full week at the bottom.</div>
    </div>
  </div>
  <div class="entry">
    <span class="tag new">new</span>
    <div>
      <strong>Monthly cadence</strong>
      <div class="body">Schedule a habit once per month, on a specific day, or "any day in the month." Backups, bills, calling people you love.</div>
    </div>
  </div>
  <div class="entry">
    <span class="tag new">new</span>
    <div>
      <strong>9pm day summary</strong>
      <div class="body">A single end-of-day notification if anything's still outstanding. Tap to triage.</div>
    </div>
  </div>
  <div class="entry">
    <span class="tag new">new</span>
    <div>
      <strong>Compliance view</strong>
      <div class="body">Per-habit detail page now shows last 12 weeks at a glance, plus the monthly heatmap.</div>
    </div>
  </div>
  <div class="entry">
    <span class="tag imp">improved</span>
    <div>
      <strong>Skip vs miss</strong>
      <div class="body">Skipping a day is a distinct state now, not an absence. Your compliance % no longer punishes you for a planned skip.</div>
    </div>
  </div>
  <div class="entry">
    <span class="tag imp">improved</span>
    <div>
      <strong>Notification copy</strong>
      <div class="body">Rotates through five lines instead of one. Less robotic, more like a friend texting.</div>
    </div>
  </div>
  <div class="entry">
    <span class="tag fix">fix</span>
    <div>
      <strong>Time-zone bug on long flights</strong>
      <div class="body">Crossing the dateline no longer creates a phantom missed day.</div>
    </div>
  </div>
  <div class="entry">
    <span class="tag fix">fix</span>
    <div>
      <strong>Android wear notifications</strong>
      <div class="body">Reminders now mirror to paired watches properly.</div>
    </div>
  </div>
  <div class="entry">
    <span class="tag fix">fix</span>
    <div>
      <strong>Dark mode contrast on the week strip</strong>
      <div class="body">The "missed" dash was nearly invisible. It is not anymore.</div>
    </div>
  </div>
</div>

## What I cut

The biggest cut was a "coach" panel that surfaced suggestions based on
your patterns ("you tend to miss Wednesdays, want to move it?"). It
tested well but felt off-brand. nag is a tool, not a coach. If you
want to move Wednesday, you'll move it.

Also gone: badges, levels, weekly emails, a social feed (briefly
considered, briefly built, immediately deleted), and a paid tier.

## What's next

Honestly, less than you'd think. The main 1.1 work is sync between
platforms — currently each platform syncs to its own cloud only.
Beyond that, I'd like to add a desktop "ok do it." companion that
lives in your menu bar. [Subscribe to the blog](#) if you
want to hear when it ships.

Thanks to everyone who tested through the beta. You absolutely
nagged me into this.

---

<p style="font-family: var(--mono); font-size: 14px; color: var(--nag-mute);">
  Filed under: <a href="#" style="color: var(--nag-orange);">releases</a>.
  Permalink: <code>/blog/release-1-0</code>.
</p>

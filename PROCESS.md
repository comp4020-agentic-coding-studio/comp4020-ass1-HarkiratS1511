# Process overview

A reading-guide to how this prototype came together. It's an orchestrated
pipeline: I set the concept and the calls and directed subagents to build each
phase, but every phase was gated behind verification I ran myself before
committing.

## What I built

**"Every pop song is the same four chords."** An interactive explainer proving
five famous pop songs — *I'm Yours*, *Where Is the Love?*, *Someone Like You*,
*With or Without You*, *She Will Be Loved* — are all the same I–V–vi–IV
progression in different keys. Each first appears in its released key, so the
chord letters look nothing alike. An **Align** control transposes all five to
one key and they snap to identical chords, while the Roman-numeral row (always
I V vi IV) never moves — that constant row is the point. You can also *hear* it:
each song plays its four-chord loop, and aligned songs sound identical. The
point of view: a shared musical language, not a "pop is lazy" gotcha.

## The moments that mattered

1. **The claim had to be true before anything else.** Two early picks (*Let It
   Be*, *Don't Stop Believin'*) aren't pure I–V–vi–IV loops — one only opens on
   the shape, the other substitutes a iii. The agent flagged it; the easy move
   was to fudge the wording. Instead I swapped them for
   songs I verified are pure loops end to end, because the piece collapses if the
   claim is dishonest. Each final song's chords are asserted in a unit test, and
   an *invariant* test asserts all five produce identical labels aligned and
   distinct labels apart — so a wrong song fails the suite.
   [`5f565cd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/5f565cd)

2. **Derive the chords from music theory; never hard-code them per song.** The
   tempting shortcut is a per-song lookup table. Instead the core is a pure
   module that *derives* the correctly-spelled I, V, vi, IV from any tonic
   (flat keys get flats, sharp keys sharps, no doubled letters). That makes
   "align" provable rather than staged: aligning is just rendering every song
   from the same tonic, so they *must* come out identical — no per-song copy can
   disagree, and the browser reads its labels from that same module.
   [`5f565cd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/5f565cd)

3. **Verify what the tests can't see — in a real browser.** The spec suite runs
   against static `dist/` HTML (JSDOM); it proves the hooks exist but not that
   clicking *Align* transposes, or that audio retunes with the key. So I drove
   the built site in headless Chromium: unaligned = five distinct keys, aligned =
   all C/G/Am/F, reset restores each key — and, for audio, aligned songs produce
   an *identical frequency set* while unaligned songs differ (the thesis, in
   sound). A subagent can't hear its own output; this is how I knew.
   [`c5a9249`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/c5a9249) ·
   [`581e0bd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/581e0bd)

4. **A subagent's green `pnpm check` is necessary, not sufficient.** The build
   passed every check with the phone layout broken: it had shipped with *no
   responsive breakpoints*, so the song grid overflowed the 390px viewport and
   the align toolbar buried a song at both viewports — none of which
   `tsc`, lint, or the spec can see. I caught it only by screenshotting the built
   site at both marked viewports (390×844 and 1920×1080), reading the overflow
   measurement, briefing the fix — stack on mobile, dock the toolbar aside — and
   re-verifying by screenshot.
   [`581e0bd...798e209`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/compare/581e0bd...798e209)

## Where to look

The history reads as one commit per phase, each committed only after its
verification passed — the pure module and failing spec
([`5f565cd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/5f565cd)),
the reveal + align UI
([`c5a9249`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/c5a9249)),
the audio engine
([`581e0bd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/581e0bd)),
and the responsive/a11y pass
([`798e209`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/798e209)).
Harness lessons are in `CLAUDE.md`; the personal reflection in
`reflections/assignment-1.md`.

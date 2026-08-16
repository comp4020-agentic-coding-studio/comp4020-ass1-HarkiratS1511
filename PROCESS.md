# Process overview

A reading-guide to how this prototype came together. It's an orchestrated
pipeline: I set the concept and the calls and directed subagents to build each
phase, but every phase was gated behind verification I ran myself before
committing.

## What I built

**"Every pop song is the same four chords."** An interactive explainer proving
five famous songs — *I'm Yours*, *Where Is the Love?*, *Someone Like You*,
*With or Without You*, *She Will Be Loved* — are all the same I–V–vi–IV
progression in different keys. Each first appears in its released key, so the
chord letters look nothing alike. An **Align** control transposes all five to
one key and they snap to identical chords while the Roman-numeral row never
moves; a live counter watches **16 distinct chord names collapse to 4**. You can
*hear* it too — each song plays its loop, aligned songs sound identical, and
"all five at once" lets you hear them clash apart and lock together. Then you
take the desk: the **forge** lets you rearrange the four chords in any order and
names the loop-family you built. The point of view: a shared musical language
you can hold yourself, not a "pop is lazy" gotcha.

## The moments that mattered

1. **The claim had to be true — and stay true as the piece grew.** Two early
   picks (*Let It Be*, *Don't Stop Believin'*) aren't pure I–V–vi–IV loops. The
   agent flagged it; the easy move was to fudge the wording. Instead I swapped
   them for songs I verified end to end and locked it with an *invariant* test:
   all five must render identical labels aligned and distinct apart, so a wrong
   song fails the suite. The same rule caught the forge later — I cut *Blue
   Moon* from the doo-wop list once I checked it's really I–vi–ii–V, and for the
   loop orders no household hit uses, the verdict says exactly that instead of
   inventing one.
   [`5f565cd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/5f565cd) ·
   [`07a48e6`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/07a48e6)

2. **Derive from one source of truth; never hard-code per instance.** The core
   is a pure module that *derives* the correctly-spelled I, V, vi, IV from any
   tonic. That makes "align" provable rather than staged — aligning is just
   rendering every song from one tonic, so they *must* match. That module then
   paid for two features for free: the live **16 → 4** counter reads its
   distinct-name count straight from it, and the forge names all 24 chord orders
   by deriving the loop-family from the degree math — so no rearrangement can
   drift from what you actually built.
   [`a38a532`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/a38a532)

3. **Verify what the tests can't see — in a real browser.** The spec suite runs
   against static `dist/` HTML (JSDOM); it proves the hooks exist, not that
   *Align* transposes or audio retunes. So I drove the built site in headless
   Chromium: aligned songs produce an *identical frequency set*, unaligned ones
   differ — the thesis, in sound. The collision ("all five at once") is only
   provable by ear, and a browser pass caught the forge shipping with a muted
   collision and a broken drag-reorder.
   [`581e0bd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/581e0bd) ·
   [`868972b`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/868972b) ·
   [`cf1a18d`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/cf1a18d)

4. **A subagent's green `pnpm check` is necessary, not sufficient.** The build
   passed every check with the phone layout broken — no responsive breakpoints,
   the song grid overflowing 390px, the align toolbar burying a song — none of
   which `tsc`, lint, or the spec can see. I caught it only by screenshotting
   both marked viewports (390×844 and 1920×1080) and reading the overflow
   measurement.
   [`798e209`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/798e209)

## Where to look

The history reads as one verified phase per commit: the pure module and failing
spec
([`5f565cd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/5f565cd)),
the reveal + align UI
([`c5a9249`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/c5a9249)),
the audio engine
([`581e0bd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/581e0bd)),
the responsive/a11y pass
([`798e209`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/798e209)),
the collision
([`868972b`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/868972b)),
the 16→4 counter
([`a38a532`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/a38a532)),
and the forge with its loop-family rebuild
([`6ea8a7d`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/6ea8a7d) →
[`07a48e6`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/07a48e6)).
Harness lessons are in `CLAUDE.md`; the personal reflection in
`reflections/assignment-1.md`.

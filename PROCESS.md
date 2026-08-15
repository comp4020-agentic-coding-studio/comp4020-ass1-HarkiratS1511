# Process overview

A reading-guide to how this prototype came together. It's built as an
orchestrated pipeline: I set the concept and the calls, and directed subagents
to build each phase, but every phase was gated behind verification I ran myself
before it was committed. Follow the citations to see where the judgement lived.

## What I built

**"Every pop song is the same four chords."** An interactive explainer that
proves five famous pop songs — *I'm Yours*, *Where Is the Love?*, *Someone Like
You*, *With or Without You*, *She Will Be Loved* — are all the same I–V–vi–IV
progression in different keys. Each song first appears in the key it was
released in, so the chord letters look nothing alike. An **Align** control
transposes all five to one shared key and they snap to identical chords, while a
Roman-numeral row (always I V vi IV) never moves — that constant row is the
whole point. You can also *hear* it: each song plays its four-chord loop, and
aligned songs play the identical progression. The point of view is that this is
a shared musical language, not a "pop is lazy" gotcha.

## The moments that mattered

1. **The claim had to be true before anything else.** Two of my first song picks
   (*Let It Be*, *Don't Stop Believin'*) aren't actually pure I–V–vi–IV loops —
   one only opens on the shape, the other substitutes a iii. The agent flagged
   it; the obvious move was to fudge the wording ("mostly these chords"). Instead
   I swapped them for songs I verified are pure loops end to end, because the
   entire piece collapses if the claim is dishonest. How I knew it held: each
   final song's chords are asserted in a unit test, and an *invariant* test
   asserts all five produce identical labels at the shared key and distinct
   labels at their own — so a wrong song fails the suite.
   [`5f565cd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/5f565cd)

2. **Derive the chords from music theory; never hard-code them per song.** The
   tempting shortcut is a lookup table of each song's four chords. I made the
   core a pure module that *derives* the correctly-spelled I, V, vi, IV from any
   tonic (flat keys get flats, sharp keys get sharps, no doubled letters). That's
   what makes "align" provable rather than staged: aligning is literally rendering
   every song from the same tonic, so they *must* come out identical — there's no
   per-song copy that could disagree. The invariant test is the proof, and the
   browser reads its labels from the same module.
   [`5f565cd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/5f565cd)

3. **Verify what the tests can't see — in a real browser.** The spec suite runs
   against static `dist/` HTML (JSDOM); it can prove the hooks exist but not that
   clicking *Align* actually transposes, or that the audio retunes with the key.
   So I stood up a headless-Chromium rig and drove the built site: it confirmed
   unaligned = five distinct keys, aligned = all C/G/Am/F, reset restores each
   key, the Roman row stays constant — and, for audio, that aligned songs produce
   an *identical frequency set* while unaligned songs differ (the thesis proven in
   sound, octave-agnostically). A subagent can't hear its own output; this is how
   I knew the sound was right.
   [`c5a9249`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/c5a9249) ·
   [`581e0bd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/581e0bd)

4. **A subagent's green `pnpm check` is necessary, not sufficient.** The build
   passed every check with the phone layout broken: the design had shipped with
   *no responsive breakpoints*, so the song grid overflowed the 390px viewport by
   ~200px and the align toolbar opaquely buried a song at both viewports — none of
   which `tsc`, lint, or the spec can see. I only caught it by screenshotting the
   built site at the two marked viewports (390×844 and 1920×1080) and reading the
   overflow measurement, then briefing the fix (stack on mobile, dock the toolbar
   to the viewport bottom) and re-verifying by screenshot.
   [`581e0bd...798e209`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/compare/581e0bd...798e209)

## Where to look

The history reads as one commit per phase, each committed only after its
verification passed: the pure module and its failing spec contract
([`5f565cd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/5f565cd)),
the reveal UI + align interaction
([`c5a9249`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/c5a9249)),
the Web Audio engine
([`581e0bd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/581e0bd)),
and the responsive/animation/a11y pass
([`798e209`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/798e209)).
The harness lessons this build taught are written into `CLAUDE.md`; the personal
reflection is in `reflections/assignment-1.md`.

# Process overview

A short guide to how this came together. I set the concept and directed agents
to build each part, but I checked each part myself in a browser before
committing it. That pattern runs through the whole history.

## What I built

"Every pop song is the same four chords." An interactive explainer showing that
five famous songs (*I'm Yours*, *Where Is the Love?*, *Someone Like You*, *With
or Without You*, *She Will Be Loved*) are all the same I-V-vi-IV progression in
different keys. Each starts in its real released key, so the chords look nothing
alike at first. Hit Align and all five snap into one key and the same four
chords, while the Roman numeral row (I V vi IV) stays put, and a counter shows
the 16 chord names dropping to 4. You can hear it too: aligned songs sound
identical, and "all five at once" lets you hear them clash apart and lock
together. At the end you take over: the forge lets you drag the four chords into
any order and tells you which loop you wrote. My point is that this is a shared
language anyone can use, not that pop music is lazy.

## The moments that mattered

1. **I had to be sure the claim was actually true.** Two of my first picks
   (*Let It Be*, *Don't Stop Believin'*) are not clean I-V-vi-IV loops. The
   agent flagged it, and the lazy fix was to soften the wording. Instead I
   swapped them for songs I checked myself, and wrote a test that
   fails if any of the five don't line up. The same rule came back in the forge:
   I cut *Blue Moon* from the doo-wop list once I checked it is really
   I-vi-ii-V, and for the chord orders no famous song uses, the site says so
   rather than making one up.
   [`5f565cd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/5f565cd) ·
   [`07a48e6`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/07a48e6)

2. **I worked the chords out from theory instead of typing them in per song.**
   One small module takes a key and returns the right I, V, vi, IV. That is what
   makes Align honest: lining the songs up is just drawing them all from the
   same key, so they have to match, with no hidden list that could be wrong.
   That module later did two more jobs for free. The 16-to-4 counter reads its
   number from it, and the forge names all 24 possible chord orders off the same
   maths, so it can never disagree with what you dragged.
   [`a38a532`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/a38a532)

3. **The automated checks could not see the actual thing I was building.** They
   run against the plain HTML: they can tell a button exists, not that Align
   moves the songs or the audio changes key. So I opened the built site in a
   real browser and checked there. Aligned songs really do come
   out as the same notes, and the clash you hear apart is real. The same pass
   caught the forge going out with muted audio and a broken drag.
   [`581e0bd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/581e0bd) ·
   [`868972b`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/868972b) ·
   [`cf1a18d`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/cf1a18d)

4. **An agent saying "checks pass" is not the same as it working.** One build
   passed every check with the phone layout broken: songs spilling off the side,
   the toolbar sitting on a song. None of the checks can see that. I only found
   it by screenshotting both sizes (390 and 1920 wide) and actually looking.
   [`798e209`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/798e209)

## Where to look

One finished piece per commit: the chord module and its first failing test
([`5f565cd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/5f565cd)),
the Align UI
([`c5a9249`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/c5a9249)),
the audio
([`581e0bd`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/581e0bd)),
the responsive and accessibility pass
([`798e209`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/798e209)),
the "all five at once" clash
([`868972b`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/868972b)),
the 16-to-4 counter
([`a38a532`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/a38a532)),
and the forge with its rewrite into loop families
([`6ea8a7d`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/6ea8a7d)
to
[`07a48e6`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-HarkiratS1511/commit/07a48e6)).
Harness notes are in `CLAUDE.md`, the personal reflection in
`reflections/assignment-1.md`.

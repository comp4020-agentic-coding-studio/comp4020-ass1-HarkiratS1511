<!-- DRAFT SCAFFOLD — this is grounded in what actually happened, but the
     reflection is yours. Rewrite it in your own voice before you ship, and
     especially replace anything in [brackets] in the second answer: the marker
     is reading for *your* judgement and *your* growth, not the agent's. -->

# Assignment 1 — reflection

## What was the breakthrough that moved the work forward?

The breakthrough was deciding that the demo had to be *provably* true, not just
convincing-looking, and building the project around that. Two of my first song
choices turned out not to be pure I–V–vi–IV loops, and the easy path was to
soften the wording. Instead I swapped them for songs I verified, and — more
importantly — I stopped hard-coding each song's chords and made a single pure
module *derive* the four chords from a key. That one decision is what made
"align" real: aligning every song is just rendering them all from the same
tonic, so they *must* come out identical; there's no per-song copy that could
lie. An invariant test asserts exactly that.

The second half of the breakthrough was realising the automated checks couldn't
actually see the thing I was building. `pnpm check` runs against static HTML and
happily passed while the phone layout was broken. So I drove the built site in a
real browser to prove the parts that matter — that clicking Align genuinely
transposes all five songs, that the audio retunes with the key, and that
nothing overflows at 390px. Treating "verify what the tests can't" as its own
step is what caught the real defects.

## What did this work change about who you want to be as a software developer?

<!-- This is the part only you can write. Some honest starting questions: -->
<!-- - Directing agents to build while you stay the verifier — how did that -->
<!--   change what you think your job actually is? -->
<!-- - You chose factual honesty over a slicker-sounding claim. What does that -->
<!--   say about the standards you want to hold? -->
<!-- - The green check that lied to you — how does that change how much you'll -->
<!--   trust automated sensors vs. looking at the artefact yourself? -->

[Your answer — a few sentences in your own voice. For example: this project
changed how I think about my role: the leverage wasn't in writing the code, it
was in deciding what "correct" meant and building the checks that could prove
it. I want to be the kind of developer who … ]

// The five songs behind the thesis: different artists, different keys,
// same I–V–vi–IV progression. Deliberately data-only — no chord letters
// live here. The four chords for a song's tonic (or for the aligned key)
// are always derived by src/lib/chords.ts, so "align" only has to change
// one number (the shared tonic) and every song's chords update correctly.

export interface Song {
  title: string;
  artist: string;
  /** The song's real key, e.g. "B", "Eb", "F". Fed straight into chords.ts. */
  tonic: string;
  /** Where in the song the progression appears. */
  section: string;
}

export const SONGS: Song[] = [
  {
    title: "I'm Yours",
    artist: "Jason Mraz",
    tonic: "B",
    section: "verse & chorus",
  },
  {
    title: "Where Is the Love?",
    artist: "Black Eyed Peas",
    tonic: "F",
    section: "verse & chorus",
  },
  {
    title: "Someone Like You",
    artist: "Adele",
    tonic: "A",
    section: "chorus",
  },
  {
    title: "With or Without You",
    artist: "U2",
    tonic: "D",
    section: "whole song",
  },
  {
    title: "She Will Be Loved",
    artist: "Maroon 5",
    tonic: "Eb",
    section: "chorus",
  },
];

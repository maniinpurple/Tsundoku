// Values hianime can change on us. Keep them here so a change is a one-line fix.
export const hianimeConfig = {
  // The site moves between mirror domains (hianime.at -> hianime.fm in Nov 2026),
  // so match any "hianime.<tld>" instead of one fixed domain.
  hostPattern: /^(www\.)?hianime\.[a-z]{2,}$/i,
};

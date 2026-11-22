export const zokoConfig = {
  hostPattern: /^(www\.)?zokoanime\.[a-z]{2,}$/i,
  // OBF_KEY in https://zokoanime.video/core/obfuscate.js
  key: "otaku-embed-v1",
  blobPattern: /window\.__P\s*=\s*"([^"]+)"/,
};

# Dotted favicon source

The favicon uses the approved Night Reverse detailed symbol from the production
logo pack, with the existing DeepGym favicon colors: Acid Lime `#D7F651` on
Night `#0A0A0C`.

- `favicon.svg` is based on
  `02-vector/square/deepgym-symbol-lime-detailed-square.svg`; only the official
  Night background rectangle and favicon-specific accessible title were added.
- `source-symbol-512x512.png` is the untouched
  `03-raster/transparent-lime/detailed/deepgym-symbol-lime-detailed-512x512.png`
  export from the pack.
- The 16, 32, and 48 px PNGs and the multi-size ICO are rasterized from that
  source on the same Night background.

`npm run icons` verifies checksums and installs these files without modifying
them.

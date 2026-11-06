# Publishing

The Chrome Web Store package is a zip of `dist/`, not a zip of the repository. Source maps stay out of that zip. The repository stays the public source tree.

## Make the zip

```text
npm run package
```

That builds with `--release`, copies `LICENSE` and `NOTICE` into `dist/`, and writes `release/beyond-full-art-<version>.zip`. The version comes from `manifest.json` and must match `package.json`. The zip root is `manifest.json`. `release/` is gitignored.

Upload that zip in the Chrome Web Store dashboard. Do not upload `node_modules/`, `src/`, `tests/`, or a folder that contains `.map` files.

Load `dist/` unpacked to check the same build before you upload it. `npm run build` and `npm run watch` still write source maps for local debugging. Run `npm run package` again after the check so the upload does not include them.

## Listing facts

Use these until the store listing has its own copy.

| Field | Value |
| --- | --- |
| Name | Beyond Full Art |
| Summary | Unofficial D&D Beyond companion for local character art, journals, and portraits. |
| Homepage | https://github.com/dpack1/beyond-full-art |
| Privacy policy | https://github.com/dpack1/beyond-full-art/blob/main/PRIVACY.md |
| Support | https://github.com/dpack1/beyond-full-art/issues |
| Optional tip | https://ko-fi.com/dpack1 |

The privacy URL works after this repository is public. The store requires that URL because the extension stores character art and journals.

Single purpose, for the dashboard:

> Beyond Full Art keeps a local full-art image, portrait crop, and character journal for D&D Beyond characters. It can also sharpen card portraits and show one companion portrait from Extras. It does not replace the character sheet.

The item is not affiliated with or endorsed by D&D Beyond or Wizards of the Coast. Say that in the store description. The manifest description already starts with "Unofficial".

Add this sentence to the store description. Leave the Support URL on the issue tracker. The tip link is optional and does not unlock a feature.

> Beyond Full Art stays free. If it helps your table, you can leave a tip at https://ko-fi.com/dpack1. A tip does not unlock anything.

Screenshots of the journal, folder, copy prompt, and deletion prompt are a separate README pass. The store accepts 1280×800 or 640×400 PNGs. Do not use a screenshot that shows someone else's account or a private character you do not want public.

## Permission justifications

`storage`: save art metadata, journal text, and settings on this browser.

`webRequest` with host `https://character-service.dndbeyond.com/character/v5/character*`: notice a finished character delete. The listener is not blocking. The same host is the only one the extension asks for. `offscreen` keeps a hidden extension page open so the backup folder stays readable after the toolbar popup closes. It does not add a host.

Content scripts on `https://www.dndbeyond.com/characters*` and `https://www.dndbeyond.com/campaigns/*`: draw the viewer, journal, crop controls, card portraits, and companion portrait on those pages.

The extension does not request `unlimitedStorage`, `downloads`, `<all_urls>`, or a remote code host.

## Version

`manifest.json` `version` is the store version. Keep `package.json` `version` the same string. Bump both before a new upload. Chrome rejects an upload whose version is not greater than the published one.

## After publication

Replace "There is no Chrome Web Store release yet" in `README.md` with the store link. Leave the unpacked install steps in place for people who build from source.

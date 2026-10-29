# Privacy policy

Beyond Full Art is an unofficial browser extension. It does not run a server, create an account, or send your character data to the author.

## What stays on your machine

The extension stores, on the browser where you installed it:

- one full-art image and one portrait crop per character
- journal notes and journal photos
- popup settings, including companion choices and the deleted-character choice

Image bytes live in the extension's IndexedDB until you choose a backup folder. Note text and settings live in `chrome.storage.local` until that folder is the library. After a verified folder is the library, art, crops, notes, and photos are read from and written to that folder. Settings stay in the browser, and a copy is written to `settings.json` in the folder so another computer using the same folder can pick them up.

A backup folder you place inside Google Drive, Dropbox, or a similar folder is synced by that service. Beyond Full Art does not upload those files and does not talk to that service.

Export downloads a journal ZIP through your browser. Import reads a ZIP you choose. Neither one is sent to a server by this extension.

## What the extension reads

On D&D Beyond pages the extension is allowed to run, it reads the page so it can show stored art, the journal, card portraits, and a companion portrait. It does not change D&D Beyond's requests except to notice two finished character-service results:

- a successful character delete, so it can ask whether to remove that character's stored data
- a successful character copy, so it can ask whether to give the new character its own journal

The host permission is limited to `https://character-service.dndbeyond.com/character/v5/character*`. The `webRequest` permission watches that address. The page script reads the finished delete or copy response in the page. Those ids and statuses are used on your machine. They are not forwarded anywhere else.

The journal and stored artwork are displayed inside the D&D Beyond page. Like any content inserted by a browser extension, that displayed DOM can be observed by D&D Beyond and other scripts already running on that page. Do not put passwords, authentication tokens, or other secrets in a journal note. Beyond Full Art does not intentionally expose journal data through page messages or send it over the network.

## Limited Use

Beyond Full Art's use of information received from Chrome APIs and D&D Beyond is limited to providing and improving the extension's single purpose described above. The extension does not sell user data, use it for advertising or credit decisions, or transfer it to third parties. The developer does not read locally stored user data unless a user explicitly chooses to share specific material for support. Beyond Full Art's use of information received from Chrome APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## What is not collected

- no analytics
- no advertising
- no remote code
- no intentional collection or storage of account, email, or payment data
- no copy of your D&D Beyond password or session sent off the page

## Removing data

Turning the extension off leaves the stored data in place. Removing the extension removes the copies stored in the browser. Files in a backup folder remain until you delete them yourself.

Deleting one character from the extension removes that character's stored data after you confirm it. Deleting one photo from the journal removes that photo. Other characters stay.

## Contact

Questions about this policy can go to the [issue tracker](https://github.com/dpack1/beyond-full-art/issues). Do not include character files, session cookies, or folder contents in an issue.

This policy applies to the extension distributed from this repository. It was last updated on 2026-10-29.

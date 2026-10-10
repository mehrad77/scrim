# Templates

The template gallery offers a starting show for each kind of person in [users and the user journey](users-and-journey.md): a teacher's school play, a volunteer's Sunday lyrics, a care home's memory session, and so on.

A template is a complete show that runs as it is. It looks good enough to put in front of people tonight, has the settings its user needs already on, and comes with a short Learn checklist that turns it into _their_ show.

## How a template is made

Each template is a **seed**: a TypeScript object in `apps/web/src/templates/`.

- **What it describes:** who it's for, what it needs, what to replace, what it can't do yet, the files it uses, and its Learn steps.
- **`make(media)`:** builds the show from the media it's given.
  - It is pure, so `templates.test.ts` can run it in Node.
  - It uses the same builders as the editor's wizards (`lib/build/`), and the layout kit in `templates/layout.ts`.
  - So a template is made only of ordinary scenes, cues, layers, values and rules, and stays fully editable.
- **Choosing it** (`templates/create.ts`):
  1. Fetch its files once per machine (`templates/assets.ts`).
  2. Store them as the show's media.
  3. Build the show.
  4. Note how it started (`rememberTemplate` in `lib/learn.ts`), so the Learn checklist can tell what has changed since.

Templates made this way get fresh ids every time.

## Media

Template media ships with the app in `apps/web/public/templates/`. It is downloaded only when someone picks that template, and it isn't in the offline precache, except each template's `thumb.webp`.

**Where each file comes from** is recorded in `apps/web/scripts/template-media/sources.json`, which is curated by hand:

- the source URL;
- how the file is cut and encoded;
- its credit and licence.

**`node scripts/template-media/build.mjs`** (in `apps/web`) downloads and encodes each file, and writes `public/templates/index.json` with every file's size, hash and credit. It needs `ffmpeg` and `cwebp`, and encodes:

- **pictures:** WebP, at most 1920 px wide, about 400 KB each;
- **video:** H.264 MP4 at 1080p with no sound, cut as a seamless loop (the last second dissolves into the first);
- **sound:** AAC at 160 kbps, levelled to −18 LUFS;
- **fonts:** the Latin subset as WOFF2, with its OFL licence beside it.

**Joining from the stage.** Most templates put the room's QR code and code on stage (`joinCard` in `layout.ts`): a text layer reading `{{join_url}}` with `qr` on, and one reading `{{join_code}}`. Both stay empty until the operator opens the audience room.

**Budget:** at most 40 MB per template (80 MB for the gig, which has video) and 250 MB in all. `templates.test.ts` and `pnpm --filter @scrim/web budget` check it.

### What we may use

Only these, with no exceptions:

- **Public domain** (`PD`), with the reason in `basis`:
  - **Music:** the composition is public domain (its writers died before 1955), and the recording is CC0, a US government band's, or was published 100 or more years ago (in 2026, in 1925 or earlier; US law frees one more year each January).
  - **US government work** (NASA, NOAA) is public domain. Logos, insignia and recognisable people in endorsement poses are excluded.
  - **Library of Congress** items must be clearly public domain, not just marked "no known restrictions".
- **CC0** (`CC0-1.0`): for example, museum open-access collections such as the Met, the Art Institute of Chicago, the Rijksmuseum and the National Gallery of Art.
- **OFL** (`OFL-1.1`): fonts only.

**Checking a file:** read its licence on the source page itself, not on an aggregator. If there's doubt, use a different piece rather than guess. `templates.test.ts` fails on any file without a credit, or with a licence outside this list.

## The visual bar

Every template is held to the same bar, and the harness (`templates/harness.ts`) checks what can be checked:

- **Grid:**
  - a 1920 × 1080 stage;
  - title-safe margins of 96 × 56 px;
  - twelve columns (`cols()` in `layout.ts`);
  - spacing in steps of 8 px.
- **Type:**
  - each template has its own scale and at most two families;
  - text the audience reads is at least the template's `minText` (56 px; 84 px for lyrics and care);
  - wall labels and credits are at least 32 px.
- **Contrast:** text on a solid backing reaches the template's `minContrast` (4.5:1, or 7:1 for lyrics and care). Text over a picture sits on a frame, over a gradient **scrim** (a frame named `Scrim · …`), or has a shadow.
- **Fit:** text stays inside the title-safe area and inside its frame, and every text a cue sets fits its box (estimated from each font's letter width).
- **Motion:** fades only, and every template passes the flash check.

**What a person checks:** every scene has one deliberate composition, its hero frame. These are reviewed on a contact sheet before a template ships.

## The checks

`templates.test.ts` runs `checkTemplate` on every seed. For each seed, it checks:

- the show parses, and the logic and flash checks report nothing;
- every vote can be rehearsed with each of its options;
- running the show the way an operator would, every moment left to its default, raises no warning;
- run as a relaxed performance, nothing intense shows;
- every fetched file is used, and every media reference resolves;
- the visual bar above;
- the Learn checklist starts with nothing done;
- the download fits its budget.

`FIXTURE_SEED` (`templates/fixture.ts`) is a small template, not in the gallery, that keeps the harness itself honest.

## Hero frames and contact sheets

A seed's `heroes` names the cues whose stage is each scene's deliberate composition; the first is the gallery thumbnail. With the dev server running, `node scripts/template-shots.mjs [ids…]` (in `apps/web`):

1. builds each template in a real page;
2. writes the settled stage after each hero cue to the journal and opens the real output window at 1920 × 1080, with a sample room code;
3. saves a frame per hero in `.shots/<id>/` (not committed) and `public/templates/<id>/thumb.webp`;
4. fails if any text on stage is cut off, measured as drawn.

Review the frames on the contact sheet (`.shots/index.html`) before a template ships.

## Games

A vote whose every answer must lead somewhere different is the default: the harness fails a choice that doesn't branch. A guess or a tap race is a game, not a choice; a seed lists those in `games`.

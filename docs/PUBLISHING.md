# Publishing a new version

This is a reference checklist for releasing a new version of this integration
and, eventually, submitting it to the HACS default store. Based on the
official docs at [hacs.xyz/docs/publish](https://hacs.xyz/docs/publish/) —
check there for anything not covered here, as the process can change.

## Every release

1. Bump `version` in `custom_components/smart_heating/manifest.json`.
   If the card changed too, bump `version` in `package.json` as well.
2. Run both test suites locally (`pytest`, `npm test`) - CI runs them again,
   but catching failures early saves a round trip.
3. Push to `main`. Wait for the `Validate` GitHub Action to go green (HACS
   action, hassfest, pytest, node tests).
4. Create a **GitHub Release** (not just a tag!) with a tag matching the
   version exactly, e.g. `v0.8.1`. HACS uses the release tag as the version
   users see - a tag alone is not enough, and the `release.yml` workflow will
   fail the run if the tag doesn't match `manifest.json`.
5. Users on the custom-repository track get the update automatically the
   next time HACS checks (or via "Redownload").

## Repository requirements (one-time, keep them true)

These are what HACS itself, and later a `hacs/default` review, will check:

- **Description** set on the GitHub repo (used in the HACS UI)
- **Topics** set on the GitHub repo (Settings → General → Topics) - not
  automatable via committed files, has to be done in the GitHub UI
- **Issues enabled** on the repo
- **Not archived**
- A **README** with real usage instructions (this repo has one)
- `hacs.json` with at least `name` (this repo has it, plus
  `homeassistant` minimum version and `render_readme`)
- A **brand icon**: `custom_components/smart_heating/brand/icon.png` (+ `@2x`,
  `logo.png`, `logo@2x.png`). Since Home Assistant 2026.3, integrations serve
  their own brand assets directly - no PR to `home-assistant/brands` needed
  anymore for custom integrations. HACS's own default-store check falls back
  to `home-assistant/brands` only if the integration doesn't ship its own.

## Submitting to the HACS default store (optional, one-time)

Once the repo genuinely meets the bar (real users, stable, actively
maintained is *not* strictly required but strongly implied by the review
taking months), you can submit it so people don't need to add it as a custom
repository:

1. Make sure a GitHub Release exists and the `Validate` action is green -
   **both are required before you open the PR.**
2. Fork [hacs/default](https://github.com/hacs/default). Create a new branch
   from `master` (don't commit to `master` directly in your fork).
3. Add `tomasbobala/smart_heating` to the **`integration`** file
   (`hacs/default/integration`), **alphabetically sorted** — the file is a
   flat JSON array, one `"owner/repo"` string per line; a "lint sorted" CI
   check on the PR enforces this.
4. Open the PR **from your own account**, not an organization (the
   requirement is that your PR stays editable by you).
5. Fill out the PR template exactly as provided - an incorrectly filled
   template gets the PR closed without further notice, per HACS's own rules.
6. Wait. New submissions "take months to be reviewed", per the official docs.
   You can check where you are in the queue via the
   [open, non-draft PR backlog](https://github.com/hacs/default/pulls?q=is%3Apr+is%3Aopen+draft%3Afalse+sort%3Acreated-asc)
   sorted by age.
7. Automated checks on the PR include: brand icon presence, manifest
   validity, HACS's own validation, `hacs.json` sanity, "not archived", "has
   a release", "you're the owner/major contributor", repo description/
   issues/topics, valid JSON, and correct alphabetical sorting. All must pass
   unless the HACS team agreed to an exception before you opened the PR.
8. If your repository is only relevant to specific countries, set `country`
   in the *released* `hacs.json`.

After the PR is merged, the repository shows up in the default HACS store on
the next scheduled scan - no separate action needed.

## Common mistakes (learned the hard way, on this and other repos)

- Forgetting to bump `manifest.json`'s `version` before tagging a release -
  `release.yml` now catches this.
- A `codeowners` entry that isn't a valid GitHub username (no dots allowed).
- Declaring a lower `hacs.json` minimum Home Assistant version than the code
  actually requires (e.g. this integration needs HA >= 2024.12 because of how
  `OptionsFlow.config_entry` works).
- Submitting to `hacs/default` from an organization account, or before a
  release/green CI run exists.

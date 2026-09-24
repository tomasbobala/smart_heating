# Contributing

Thanks for considering a contribution to Smart Heating!

## Development setup

```bash
git clone https://github.com/tomasbobala/smart_heating.git
cd smart_heating

# Python (integration)
pip install -r requirements-test.txt
pytest

# JavaScript (card)
npm install
npm test
```

Both test suites run in CI (`.github/workflows/validate.yml`) on every push
and pull request, along with the official HACS and `hassfest` validation.
Please make sure both pass locally before opening a PR.

## Project layout

```
custom_components/smart_heating/       Python integration (config flow, coordinator, platforms)
custom_components/smart_heating/www/   Lovelace card (vanilla JS, no build step) - self-registers at startup
tests/                                 pytest (Python) + node:test (card)
.github/workflows/                     CI
```

## Making changes

- Bump `version` in `custom_components/smart_heating/manifest.json` for
  integration changes (and `package.json` if the card changed) - `release.yml`
  checks that the git tag matches on release.
- The card lives under `custom_components/smart_heating/www/` (not a
  top-level `www/`) so that HACS deploys it automatically along with the
  rest of the code, and `__init__.py` self-registers it as a frontend
  resource at startup - no manual copying or Lovelace resource needed.
- User-facing strings: `strings.json` is the canonical English source;
  `translations/sk.json` is the Slovak translation. Keep both in sync.
- Backend-generated text (decision reasons, notifications) lives in
  `custom_components/smart_heating/i18n.py` - every key needs both an `en`
  and an `sk` entry (checked by `tests/test_i18n.py`).
- Card text lives in the `I18N` object at the top of
  `custom_components/smart_heating/www/smart-heating-card.js`, same rule.

## Reporting issues

Please include your Home Assistant version, the integration version, and
relevant log lines from **Settings → System → Logs** (filter for
`smart_heating`).

## License

By contributing, you agree that your contributions will be licensed under
the project's [MIT License](LICENSE).

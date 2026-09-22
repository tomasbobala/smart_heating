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
custom_components/smart_heating/   Python integration (config flow, coordinator, platforms)
www/smart-heating-card.js          Lovelace card (vanilla JS, no build step)
tests/                             pytest (Python) + node:test (card)
.github/workflows/                 CI
```

## Making changes

- Bump `version` in `custom_components/smart_heating/manifest.json` for
  integration changes (and `package.json` if the card changed) - `release.yml`
  checks that the git tag matches on release.
- User-facing strings: `strings.json` is the canonical English source;
  `translations/sk.json` is the Slovak translation. Keep both in sync.
- Backend-generated text (decision reasons, notifications) lives in
  `custom_components/smart_heating/i18n.py` - every key needs both an `en`
  and an `sk` entry (checked by `tests/test_i18n.py`).
- Card text lives in the `I18N` object at the top of
  `www/smart-heating-card.js`, same rule.

## Reporting issues

Please include your Home Assistant version, the integration version, and
relevant log lines from **Settings → System → Logs** (filter for
`smart_heating`).

## License

By contributing, you agree that your contributions will be licensed under
the project's [MIT License](LICENSE).

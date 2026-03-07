# GitHub Pages Setup

## Overview

The static site (generated from `docs-src/`) is deployed to GitHub Pages via the CI workflow on every push to `main`.

## Custom Domain

A custom domain is configured at the appsoftwareltd organisation level:

1. **GitHub domain verification** — completed the DNS verification challenge in GitHub organisation settings before adding the custom domain.
2. **DNS record** — added a `CNAME` record (non-proxied / DNS only) pointing the subdomain to `appsoftwareltd.github.io`.
3. **HTTPS** — once GitHub verified the DNS record, HTTPS enforcement was enabled in repo Settings → Pages.

## Notes

- The `docs/` folder is wiped and regenerated on each CI run, so a `CNAME` file must be written by the CI workflow after conversion if a custom domain is used (see `build-docs` job in `.github/workflows/ci.yml`).
- Using `<user/org>.github.io` is an option for repositories without custom domains, or under an org that has a custom domain configured at the org level — in which case GitHub applies the org domain automatically.
- The GitHub Pages source is set to **GitHub Actions** in repo Settings → Pages.

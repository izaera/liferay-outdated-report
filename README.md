# Liferay Outdated Packages Reports

A daily GitHub Actions workflow that runs `node-scripts report:outdated` on every `yarn.lock` of [liferay-portal](https://github.com/liferay/liferay-portal) (`modules` and each workspace) and publishes the HTML reports, plus an index, to GitHub Pages.

## How It Works

The [workflow](.github/workflows/outdated-packages.yml) runs every day at 05:30 UTC, and on demand from the Actions tab:

1. It checks out only the `package.json`, `yarn.lock`, and `.github/CODEOWNERS` files of `liferay/liferay-portal` `master` (a sparse checkout of a few megabytes).

1. It checks out `modules/frontend-sdk/node-scripts` from the repository and ref set by the `NODE_SCRIPTS_REPOSITORY` and `NODE_SCRIPTS_REF` variables (by default, `izaera/liferay-portal` `LPD-XXXXX`, until the command reaches `master`), and installs only the packages the report needs.

1. [generate_reports.sh](scripts/generate_reports.sh) writes one report per lockfile, sharing the registry metadata between them, and [build_index.mjs](scripts/build_index.mjs) writes the index page.

1. The `site` directory is deployed to GitHub Pages.

## Running It Locally

```bash
scripts/generate_reports.sh <liferay-portal dir> <liferay-portal dir>/modules/frontend-sdk/node-scripts site
```

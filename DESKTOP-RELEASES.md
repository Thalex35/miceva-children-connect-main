# Desktop Releases

The web application deploys through Vercel. Windows desktop releases are published separately to GitHub Releases and are delivered by `electron-updater`.

## Release a version

1. Make and test code changes.
2. Update the single version source in `package.json`.
3. Commit and push the version change:

   ```bash
   npm version patch
   git push origin main --follow-tags
   ```

4. Create a GitHub Release for the tag at:
   `https://github.com/Thalex35/miceva-children-connect-main/releases/new`
5. Publish the release. The `Build Windows desktop release` workflow builds the NSIS installer and publishes its installer and update metadata to that release.
6. Existing installed desktop applications check for a release after startup. Users can choose when to download and install it.

Use `npm version patch` for `1.0.0` to `1.0.1`, `npm version minor` for `1.0.0` to `1.1.0`, and `npm version major` for `1.0.0` to `2.0.0`. These commands update `package.json` and create a local Git tag; inspect the result before pushing.

## Local commands

```bash
npm install --include=dev --no-package-lock
npm run dev
npm run build
npm run desktop
npm run desktop:build -- --publish never
```

The local desktop shell loads the production Vercel URL. Update checks are disabled while running unpackaged development builds. The Windows installer is written to `dist/` and uses the NSIS target.

## Update behavior

The packaged application checks GitHub Releases after startup. If a newer release exists, the update panel shows the current and available versions. The user starts the download, sees taskbar progress, and chooses when to restart and install. If GitHub or the download is unavailable, the application continues to work normally and offers a retry.

The updater uses the GitHub repository configured in `package.json`:
`Thalex35/miceva-children-connect-main`.

## Testing an update

To test an update, build and install a lower version first, then publish a higher semantic version through the normal GitHub Release workflow. For example:

```bash
npm version patch
# Review package.json and the generated tag
git push origin main --follow-tags
```

Create and publish the corresponding GitHub Release, install the generated NSIS installer on the test machine, and verify that the older installed version detects the newer release. Test login, Supabase connectivity, CSV export, printing, restart, and logout after installation.

Do not use `--publish always` from a developer machine unless you intentionally want to publish assets. The GitHub Actions workflow publishes release assets using its built-in `GITHUB_TOKEN`.

## Manual fallback

If automatic updating fails, download the latest `Children Management Setup <version>.exe` asset from the GitHub Release and run it. NSIS installs the new version over the existing installation while application data remains in Supabase. The updater does not modify or reset Supabase data.

## Required GitHub configuration

The repository must allow the workflow's `GITHUB_TOKEN` to write release contents. The workflow declares `contents: write`. No GitHub token is embedded in the application. Releases must be published, not only drafted, so the updater can discover them.

The application currently uses cloud Supabase data and requires internet access. Desktop application updates and Vercel web deployments are separate release processes.

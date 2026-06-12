# XVML for Visual Studio Code

Syntax highlighting and live preview for [XVML](https://github.com/kumarrajdevops/xvml) files.

## Features

- **Syntax highlighting** for all XVML commands, strings, modifiers, `on:` event bindings, `bind:` attribute bindings, and `{path}` interpolation
- **Live preview panel** — renders the current `.xvml` file to HTML as you type (debounced 400 ms), on save, and whenever the file changes on disk (git, CLI tools, AI agents)
- **In-preview navigation** — clicking `@nav` / `@link` targets like `settings.html` or `settings.xvml` opens the matching `.xvml` file in the same preview panel; external `https://` links are left alone
- **Reactive pages work** — `@if`/`@each`/`@bind`/`on:click` run live inside the preview (scripts are nonce-tagged to satisfy the WebView CSP)
- **Parse error display** — shows the error message in the preview pane instead of crashing

## Usage

1. Open any `.xvml` file
2. Click the **Open Preview** button (eye icon) in the editor title bar, or run `XVML: Open Preview` from the Command Palette (`⇧⌘P`)
3. The preview opens side-by-side and updates as you edit; click nav links to move between pages

## XVML syntax quick reference

```
@page "Title" light

@card "Section"
  @text "Hello {name}"
  @if count > 0
    @badge "Active" success
  @end
  @button "Click me" primary on:click=count=0
@end

@data
{ "name": "World", "count": 0 }
@@end
```

See the [full spec](https://github.com/kumarrajdevops/xvml/blob/main/XVML_SPEC.md) for all commands.

## Publishing to the VS Code Marketplace

### One-time setup

1. **Create a Microsoft account** at https://aka.ms/vscodepublish if you don't have one.

2. **Create a publisher** at https://marketplace.visualstudio.com/manage
   - Sign in with your Microsoft account
   - Click **Create publisher**
   - Choose a publisher ID (e.g. `kumarrajdevops`) — this must match the `"publisher"` field in `package.json`

3. **Create a Personal Access Token (PAT)**
   - Go to https://dev.azure.com → your organisation → **User settings → Personal access tokens**
   - Click **New token**
   - Set **Scopes → Marketplace → Manage** (check this box)
   - Copy the token (shown once)

4. **Log in with vsce**
   ```bash
   cd packages/vscode-xvml
   npx vsce login kumarrajdevops
   # paste the PAT when prompted
   ```

### Publish

```bash
cd packages/vscode-xvml
npm run publish
```

This runs `npm run build` (rebuilds the bundle) then `vsce publish --no-dependencies`.

### Update an existing release

Bump `"version"` in `packages/vscode-xvml/package.json`, then run `npm run publish` again.
Use [semver](https://semver.org): patch for fixes, minor for new features.

### Install locally without publishing

```bash
cd packages/vscode-xvml
npm run package                                # builds xvml-<version>.vsix
code --install-extension xvml-*.vsix --force   # --force replaces the installed copy
```

> **Always bump the version in `package.json` before repackaging** — VS Code can
> silently keep the previously-installed build when the version number is unchanged.
> After installing, reload the window (`⇧⌘P` → `Developer: Reload Window`).

### Run the tests

The preview logic (`src/preview-html.ts`) is pure and covered by vitest tests in
`src/__tests__/preview.test.ts`. They run as part of the root suite:

```bash
cd ../..   # repo root
npm test
```

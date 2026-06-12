# XVML for Visual Studio Code

Syntax highlighting and live preview for [XVML](https://github.com/kumarrajdevops/xvml) files.

## Features

- **Syntax highlighting** for all XVML commands, strings, modifiers, `on:` event bindings, `bind:` attribute bindings, and `{path}` interpolation
- **Live preview panel** — renders the current `.xvml` file to HTML as you type (debounced 400 ms) and on every save
- **Parse error display** — shows the error message in the preview pane instead of crashing

## Usage

1. Open any `.xvml` file
2. Click the **Open Preview** button (eye icon) in the editor title bar, or run `XVML: Open Preview` from the Command Palette (`⇧⌘P`)
3. The preview opens side-by-side and updates as you edit

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

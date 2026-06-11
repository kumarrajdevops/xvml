# VML Specification

**Version:** 1.0  
**Status:** Draft  
**Project:** vml-agent

---

## Overview

VML (Visual Markup Language) is a plain-text format that renders as live UI. It sits between Markdown and HTML: human-readable like Markdown, but produces structured interactive interfaces like HTML. A VML file is a sequence of commands; the renderer processes them top-to-bottom and emits a single self-contained HTML document.

---

## Core Syntax Rules

1. Every command begins with `@` on its own line.
2. The `@` token is always the first non-whitespace character on the line.
3. Commands that contain other commands are opened with their keyword and closed with `@end`.
4. String arguments are wrapped in double quotes: `"value"`.
5. Modifier arguments are bare keywords (no quotes, no punctuation): `primary`, `required`, `horizontal`.
6. Multiple arguments are space-separated on the same line as the command.
7. Lines not starting with `@` inside a block are treated as raw text content for the enclosing command.
8. Comments are lines beginning with `@#` — they are stripped before rendering.
9. Blank lines are ignored.
10. Command names are lowercase; unknown commands cause a render error.

### Argument Types

| Type       | Notation            | Example             |
|------------|---------------------|---------------------|
| `string`   | `"..."`             | `"Dashboard"`       |
| `keyword`  | bare word           | `primary`, `large`  |
| `number`   | bare integer/float  | `42`, `3.14`        |
| `boolean`  | `true` / `false`    | `required true`     |
| `path`     | `"./path/to/file"`  | `"./data.vml"`      |

---

## Command Reference

---

### Layout

---

#### `@page`

Declares the root page container. Must be the first non-meta command in a file. There is exactly one `@page` per file.

**Syntax:**
```
@page "Title" [theme-keyword]
```

**Arguments:**
| Name    | Type      | Required | Description                         |
|---------|-----------|----------|-------------------------------------|
| title   | `string`  | yes      | Document `<title>` and `<h1>` text  |
| theme   | `keyword` | no       | Theme name: `light` (default), `dark`, `system` |

**HTML output:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Title</title>
  <style>/* inlined CSS */</style>
</head>
<body class="vml-page vml-theme-light">
  <!-- child commands render here -->
</body>
</html>
```

**Example:**
```
@page "User Settings" dark
```

---

#### `@card`

A bordered, padded surface that groups related content. All UI content must live inside a `@card ... @end` block.

**Syntax:**
```
@card ["Label"] [modifier...]
  ...commands...
@end
```

**Arguments:**
| Name     | Type      | Required | Description                                  |
|----------|-----------|----------|----------------------------------------------|
| label    | `string`  | no       | Optional heading rendered at top of card     |
| modifier | `keyword` | no       | `flat` (no shadow), `outlined`, `compact`    |

**HTML output:**
```html
<section class="vml-card vml-card--flat">
  <h2 class="vml-card__label">Label</h2>
  <div class="vml-card__body">
    <!-- child commands -->
  </div>
</section>
```

**Example:**
```
@card "Account Details" outlined
  @field "Email" email required
  @button "Save" primary
@end
```

---

#### `@end`

Closes the nearest open block command (`@card`, `@section`, `@cols`, `@stat-row`, `@list`, `@table`). Has no arguments and emits no HTML itself — it is a structural delimiter consumed by the parser.

**Syntax:**
```
@end
```

**Arguments:** none

**HTML output:** none (closes parent element)

**Example:**
```
@card "Summary"
  @text "All systems nominal."
@end
```

---

#### `@section`

A logical subdivision inside a `@card`. Adds a labelled sub-group with optional separator.

**Syntax:**
```
@section "Label" [modifier...]
  ...commands...
@end
```

**Arguments:**
| Name     | Type      | Required | Description                                |
|----------|-----------|----------|--------------------------------------------|
| label    | `string`  | yes      | Section heading text                       |
| modifier | `keyword` | no       | `divided` (adds top border), `collapsible` |

**HTML output:**
```html
<div class="vml-section vml-section--divided">
  <h3 class="vml-section__label">Label</h3>
  <div class="vml-section__body">
    <!-- child commands -->
  </div>
</div>
```

**Example:**
```
@card "Profile"
  @section "Personal Info" divided
    @field "First name" text
    @field "Last name" text
  @end
@end
```

---

#### `@layout`

Sets the layout algorithm for direct children of the enclosing block.

**Syntax:**
```
@layout [mode]
```

**Arguments:**
| Name | Type      | Required | Description                                                    |
|------|-----------|----------|----------------------------------------------------------------|
| mode | `keyword` | no       | `stack` (default, vertical), `inline`, `grid`, `center`, `fill` |

**HTML output:**
```html
<div class="vml-layout vml-layout--inline">
  <!-- subsequent sibling commands in the block -->
</div>
```

**Example:**
```
@card "Actions"
  @layout inline
  @button "Cancel"
  @button "Confirm" primary
@end
```

---

#### `@cols`

Splits the enclosing area into equal-width columns. Children are distributed left-to-right.

**Syntax:**
```
@cols [count]
  ...commands...
@end
```

**Arguments:**
| Name  | Type     | Required | Description                                  |
|-------|----------|----------|----------------------------------------------|
| count | `number` | no       | Column count, 1–6. Default: `2`              |

**HTML output:**
```html
<div class="vml-cols vml-cols--3">
  <!-- child commands, each wrapped in a <div class="vml-col"> -->
</div>
```

**Example:**
```
@cols 3
  @stat "Revenue" "$12,400"
  @stat "Users" "1,024"
  @stat "Uptime" "99.9%"
@end
```

---

### Content

---

#### `@title`

Primary heading within a card or page section.

**Syntax:**
```
@title "Text" [size]
```

**Arguments:**
| Name | Type      | Required | Description                              |
|------|-----------|----------|------------------------------------------|
| text | `string`  | yes      | Heading content                          |
| size | `keyword` | no       | `xl`, `lg` (default), `md`, `sm`         |

**HTML output:**
```html
<h1 class="vml-title vml-title--lg">Text</h1>
```

**Example:**
```
@title "Welcome Back" xl
```

---

#### `@subtitle`

Secondary heading, visually subordinate to `@title`.

**Syntax:**
```
@subtitle "Text" [muted]
```

**Arguments:**
| Name  | Type      | Required | Description                         |
|-------|-----------|----------|-------------------------------------|
| text  | `string`  | yes      | Subtitle content                    |
| muted | `keyword` | no       | `muted` reduces text opacity        |

**HTML output:**
```html
<p class="vml-subtitle vml-subtitle--muted">Text</p>
```

**Example:**
```
@subtitle "Last login: 3 hours ago" muted
```

---

#### `@text`

Body paragraph text.

**Syntax:**
```
@text "Content" [modifier]
```

**Arguments:**
| Name     | Type      | Required | Description                                        |
|----------|-----------|----------|----------------------------------------------------|
| content  | `string`  | yes      | Paragraph content                                  |
| modifier | `keyword` | no       | `sm`, `muted`, `bold`, `mono`, `error`, `success`  |

**HTML output:**
```html
<p class="vml-text vml-text--muted">Content</p>
```

**Example:**
```
@text "Your changes have been saved." success
```

---

#### `@divider`

Horizontal separator rule.

**Syntax:**
```
@divider [modifier]
```

**Arguments:**
| Name     | Type      | Required | Description                          |
|----------|-----------|----------|--------------------------------------|
| modifier | `keyword` | no       | `dashed`, `thick`, `spacious`        |

**HTML output:**
```html
<hr class="vml-divider vml-divider--dashed" />
```

**Example:**
```
@divider spacious
```

---

#### `@badge`

Small inline label used for status, category, or count indicators.

**Syntax:**
```
@badge "Label" [variant]
```

**Arguments:**
| Name    | Type      | Required | Description                                               |
|---------|-----------|----------|-----------------------------------------------------------|
| label   | `string`  | yes      | Badge text                                                |
| variant | `keyword` | no       | `neutral` (default), `success`, `warning`, `error`, `info` |

**HTML output:**
```html
<span class="vml-badge vml-badge--success">Label</span>
```

**Example:**
```
@badge "Active" success
```

---

### Form

---

#### `@field`

A labelled text input.

**Syntax:**
```
@field "Label" [type] [required] [placeholder "..."] [value "..."]
```

**Arguments:**
| Name        | Type      | Required | Description                                                                         |
|-------------|-----------|----------|-------------------------------------------------------------------------------------|
| label       | `string`  | yes      | Visible label text                                                                  |
| type        | `keyword` | no       | `text` (default), `email`, `password`, `number`, `tel`, `url`, `date`, `textarea`  |
| required    | `keyword` | no       | Marks field as required; adds `required` attribute                                  |
| placeholder | `string`  | no       | Placeholder text                                                                    |
| value       | `string`  | no       | Default value                                                                       |

**HTML output:**
```html
<div class="vml-field">
  <label class="vml-field__label" for="vml-field-0">Label</label>
  <input
    id="vml-field-0"
    class="vml-field__input"
    type="email"
    placeholder="you@example.com"
    required
  />
</div>
```

**Example:**
```
@field "Email address" email required placeholder "you@example.com"
```

---

#### `@button`

An interactive button element.

**Syntax:**
```
@button "Label" [variant] [size] [disabled]
```

**Arguments:**
| Name     | Type      | Required | Description                                              |
|----------|-----------|----------|----------------------------------------------------------|
| label    | `string`  | yes      | Button text                                              |
| variant  | `keyword` | no       | `default`, `primary`, `danger`, `ghost`, `link`          |
| size     | `keyword` | no       | `sm`, `md` (default), `lg`                               |
| disabled | `keyword` | no       | Renders button in disabled state                         |

**HTML output:**
```html
<button class="vml-button vml-button--primary vml-button--lg" type="button">
  Label
</button>
```

**Example:**
```
@button "Delete Account" danger lg
```

---

#### `@checkbox`

A labelled checkbox input.

**Syntax:**
```
@checkbox "Label" [checked] [disabled]
```

**Arguments:**
| Name     | Type      | Required | Description                        |
|----------|-----------| ---------|------------------------------------|
| label    | `string`  | yes      | Checkbox label text                |
| checked  | `keyword` | no       | Renders pre-checked                |
| disabled | `keyword` | no       | Renders in disabled state          |

**HTML output:**
```html
<label class="vml-checkbox">
  <input class="vml-checkbox__input" type="checkbox" checked />
  <span class="vml-checkbox__label">Label</span>
</label>
```

**Example:**
```
@checkbox "Send me product updates" checked
```

---

#### `@select`

A dropdown select input. Options are listed as quoted strings after the command.

**Syntax:**
```
@select "Label" [required] "Option 1" "Option 2" ...
```

**Arguments:**
| Name     | Type      | Required | Description                             |
|----------|-----------|----------|-----------------------------------------|
| label    | `string`  | yes      | Visible label text                      |
| required | `keyword` | no       | Adds `required` attribute               |
| options  | `string…` | yes      | One or more option strings              |

**HTML output:**
```html
<div class="vml-select">
  <label class="vml-select__label" for="vml-select-0">Label</label>
  <select id="vml-select-0" class="vml-select__input" required>
    <option value="option-1">Option 1</option>
    <option value="option-2">Option 2</option>
  </select>
</div>
```

**Example:**
```
@select "Country" required "United States" "Canada" "United Kingdom" "Other"
```

---

#### `@link`

An anchor element.

**Syntax:**
```
@link "Label" "href" [target]
```

**Arguments:**
| Name   | Type      | Required | Description                                        |
|--------|-----------|----------|----------------------------------------------------|
| label  | `string`  | yes      | Link text                                          |
| href   | `string`  | yes      | URL or anchor path                                 |
| target | `keyword` | no       | `blank` renders `target="_blank" rel="noreferrer"` |

**HTML output:**
```html
<a class="vml-link" href="https://example.com" target="_blank" rel="noreferrer">
  Label
</a>
```

**Example:**
```
@link "View documentation" "https://docs.example.com" blank
```

---

### Data

---

#### `@table`

A data table with a header row. Columns are defined by the first `row` call; subsequent rows supply values.

**Syntax:**
```
@table [modifier]
  @row "Col 1" "Col 2" "Col 3"
  @row "Val A" "Val B" "Val C"
@end
```

Sub-command `@row` is only valid inside `@table`. First `@row` becomes `<thead>`, subsequent rows become `<tbody>` rows.

**Arguments (table):**
| Name     | Type      | Required | Description                        |
|----------|-----------|----------|------------------------------------|
| modifier | `keyword` | no       | `striped`, `compact`, `bordered`   |

**Arguments (@row):**
| Name   | Type      | Required | Description           |
|--------|-----------|----------|-----------------------|
| cells  | `string…` | yes      | Cell values           |

**HTML output:**
```html
<div class="vml-table-wrapper">
  <table class="vml-table vml-table--striped">
    <thead>
      <tr><th>Col 1</th><th>Col 2</th><th>Col 3</th></tr>
    </thead>
    <tbody>
      <tr><td>Val A</td><td>Val B</td><td>Val C</td></tr>
    </tbody>
  </table>
</div>
```

**Example:**
```
@table striped
  @row "Name" "Role" "Status"
  @row "Alice" "Admin" "Active"
  @row "Bob" "Viewer" "Inactive"
@end
```

---

#### `@stat`

A single key-value statistic display.

**Syntax:**
```
@stat "Label" "Value" [trend]
```

**Arguments:**
| Name  | Type      | Required | Description                                    |
|-------|-----------|----------|------------------------------------------------|
| label | `string`  | yes      | Metric name                                    |
| value | `string`  | yes      | Metric value                                   |
| trend | `keyword` | no       | `up`, `down`, `neutral` — renders a trend icon |

**HTML output:**
```html
<div class="vml-stat">
  <span class="vml-stat__label">Label</span>
  <span class="vml-stat__value">Value</span>
  <span class="vml-stat__trend vml-stat__trend--up">↑</span>
</div>
```

**Example:**
```
@stat "Monthly Revenue" "$48,200" up
```

---

#### `@stat-row`

A horizontal group of `@stat` items with equal spacing. Shorthand for `@cols` containing stats.

**Syntax:**
```
@stat-row
  @stat "Label" "Value"
  @stat "Label" "Value"
@end
```

**Arguments:** none on `@stat-row`; child `@stat` commands follow their own syntax.

**HTML output:**
```html
<div class="vml-stat-row">
  <div class="vml-stat">...</div>
  <div class="vml-stat">...</div>
</div>
```

**Example:**
```
@stat-row
  @stat "Users" "1,024" up
  @stat "Sessions" "4,891" up
  @stat "Bounce Rate" "34%" down
@end
```

---

#### `@progress`

A labelled progress bar.

**Syntax:**
```
@progress "Label" [value] [max] [variant]
```

**Arguments:**
| Name    | Type      | Required | Description                                           |
|---------|-----------|----------|-------------------------------------------------------|
| label   | `string`  | yes      | Visible label                                         |
| value   | `number`  | no       | Current value, 0–max. Default: `0`                    |
| max     | `number`  | no       | Maximum value. Default: `100`                         |
| variant | `keyword` | no       | `default`, `success`, `warning`, `error`              |

**HTML output:**
```html
<div class="vml-progress">
  <div class="vml-progress__header">
    <span class="vml-progress__label">Label</span>
    <span class="vml-progress__value">72%</span>
  </div>
  <div class="vml-progress__track">
    <div class="vml-progress__fill vml-progress__fill--success" style="width:72%"></div>
  </div>
</div>
```

**Example:**
```
@progress "Storage used" 72 100 warning
```

---

#### `@list`

An ordered or unordered list. Items are child `@item` commands.

**Syntax:**
```
@list [modifier]
  @item "Text"
  @item "Text"
@end
```

Sub-command `@item` is only valid inside `@list`.

**Arguments (list):**
| Name     | Type      | Required | Description                           |
|----------|-----------|----------|---------------------------------------|
| modifier | `keyword` | no       | `ordered`, `unordered` (default), `check` |

**Arguments (@item):**
| Name  | Type     | Required | Description     |
|-------|----------|----------|-----------------|
| text  | `string` | yes      | Item text       |

**HTML output:**
```html
<ul class="vml-list vml-list--check">
  <li class="vml-list__item">Text</li>
</ul>
```

**Example:**
```
@list check
  @item "Enable two-factor authentication"
  @item "Review active sessions"
  @item "Download backup codes"
@end
```

---

### Code

---

#### `@codeblock`

A syntax-highlighted code block.

**Syntax:**
```
@codeblock [language] ["filename"]
<raw code lines>
@end
```

All lines between `@codeblock` and `@end` are treated as raw text (no `@` parsing).

**Arguments:**
| Name     | Type      | Required | Description                                   |
|----------|-----------|----------|-----------------------------------------------|
| language | `keyword` | no       | Language hint: `ts`, `js`, `json`, `bash`, `html`, `css`, `vml`, etc. Default: `text` |
| filename | `string`  | no       | Optional filename label shown above block     |

**HTML output:**
```html
<div class="vml-codeblock">
  <div class="vml-codeblock__header">
    <span class="vml-codeblock__lang">ts</span>
    <span class="vml-codeblock__filename">index.ts</span>
  </div>
  <pre class="vml-codeblock__pre"><code class="vml-codeblock__code language-ts">// code here</code></pre>
</div>
```

**Example:**
```
@codeblock ts "renderer.ts"
export function render(vml: string): string {
  return parse(vml).toHTML();
}
@end
```

---

#### `@constraint`

Declares a named validation rule or system constraint. Rendered as a visually distinct rule block, useful for spec documents and configuration pages.

**Syntax:**
```
@constraint "Name" "Description" [severity]
```

**Arguments:**
| Name        | Type      | Required | Description                                    |
|-------------|-----------|----------|------------------------------------------------|
| name        | `string`  | yes      | Short constraint identifier                    |
| description | `string`  | yes      | Human-readable rule text                       |
| severity    | `keyword` | no       | `must` (default), `should`, `may`              |

**HTML output:**
```html
<div class="vml-constraint vml-constraint--must">
  <span class="vml-constraint__severity">MUST</span>
  <span class="vml-constraint__name">Name</span>
  <p class="vml-constraint__desc">Description</p>
</div>
```

**Example:**
```
@constraint "no-any" "TypeScript files must not use the any type." must
```

---

#### `@alert`

An inline alert banner for notices, warnings, and errors.

**Syntax:**
```
@alert "Message" [variant]
```

**Arguments:**
| Name    | Type      | Required | Description                                          |
|---------|-----------|----------|------------------------------------------------------|
| message | `string`  | yes      | Alert text                                           |
| variant | `keyword` | no       | `info` (default), `success`, `warning`, `error`      |

**HTML output:**
```html
<div class="vml-alert vml-alert--warning" role="alert">
  <span class="vml-alert__icon">⚠</span>
  <span class="vml-alert__message">Message</span>
</div>
```

**Example:**
```
@alert "This action cannot be undone." error
```

---

### Meta

---

#### `@spec`

Declares the VML spec version this file targets. Must appear before `@page` if present.

**Syntax:**
```
@spec [version]
```

**Arguments:**
| Name    | Type     | Required | Description                        |
|---------|----------|----------|------------------------------------|
| version | `number` | no       | Spec version number. Default: `1`  |

**HTML output:** none (parsed by renderer, stripped before output)

**Example:**
```
@spec 1
```

---

#### `@file`

Documents the source file path for this VML file. Used by the renderer to set output filename and by tooling for source maps.

**Syntax:**
```
@file "path/to/file.vml"
```

**Arguments:**
| Name | Type   | Required | Description                      |
|------|--------|----------|----------------------------------|
| path | `path` | yes      | Relative path of this file       |

**HTML output:** none (metadata only)

**Example:**
```
@file "pages/settings.vml"
```

---

#### `@meta`

Sets an arbitrary metadata key-value pair. Rendered into `<meta>` tags in the document `<head>`.

**Syntax:**
```
@meta "key" "value"
```

**Arguments:**
| Name  | Type     | Required | Description          |
|-------|----------|----------|----------------------|
| key   | `string` | yes      | Meta tag `name`      |
| value | `string` | yes      | Meta tag `content`   |

**HTML output:**
```html
<meta name="key" content="value" />
```

**Example:**
```
@meta "description" "User account settings page"
```

---

#### `@import`

Inlines the content of another `.vml` file at this position. Imports are resolved at render time; circular imports are a render error.

**Syntax:**
```
@import "path/to/file.vml"
```

**Arguments:**
| Name | Type   | Required | Description                                             |
|------|--------|----------|---------------------------------------------------------|
| path | `path` | yes      | Relative path to the `.vml` file to inline             |

**HTML output:** The fully rendered HTML of the imported file's body (without its outer `<html>` wrapper).

**Example:**
```
@import "./components/navbar.vml"
```

---

#### `@theme`

Defines theme variables. All values are inlined as CSS custom properties on `:root`.

**Syntax:**
```
@theme "name"
  "color-primary" "#6366f1"
  "color-bg" "#ffffff"
@end
```

Key-value pairs inside the block are bare `"key" "value"` lines (not commands).

**Arguments (theme):**
| Name | Type     | Required | Description                |
|------|----------|----------|----------------------------|
| name | `string` | yes      | Theme identifier           |

**HTML output:**
```html
<style>
:root {
  --vml-color-primary: #6366f1;
  --vml-color-bg: #ffffff;
}
</style>
```

**Example:**
```
@theme "brand"
  "color-primary" "#0f172a"
  "color-accent" "#6366f1"
  "font-body" "Inter, sans-serif"
@end
```

---

#### `@renderer`

Passes configuration flags to the renderer. Affects the output HTML but emits no visible content.

**Syntax:**
```
@renderer [flag...]
```

**Arguments:**
| Name        | Type      | Required | Description                                                  |
|-------------|-----------|----------|--------------------------------------------------------------|
| minify      | `keyword` | no       | Minify the HTML output                                       |
| no-scripts  | `keyword` | no       | Strip all inline JavaScript (static render only)            |
| rtl         | `keyword` | no       | Set `dir="rtl"` on `<body>`                                  |

**HTML output:** none (modifies renderer pipeline)

**Example:**
```
@renderer minify no-scripts
```

---

## Full File Example

```vml
@spec 1
@file "pages/dashboard.vml"
@meta "description" "Team dashboard overview"

@page "Team Dashboard" light

@card "Overview"
  @stat-row
    @stat "Members" "24" up
    @stat "Open Tasks" "11" neutral
    @stat "Completed" "89" up
  @end
@end

@card "Recent Activity" compact
  @table striped
    @row "User" "Action" "Time"
    @row "Alice" "Deployed v2.3" "2m ago"
    @row "Bob" "Opened PR #44" "15m ago"
  @end
@end

@card "Health"
  @progress "API uptime" 99 100 success
  @progress "Storage" 71 100 warning
@end
```

---

## Reserved — Future

The following commands are defined by name only. They **must not** appear in VML 1.0 files; the renderer will emit an error if encountered. They are reserved for a future reactive/scripting extension.

| Command      | Intended purpose                                                    |
|--------------|---------------------------------------------------------------------|
| `@if`        | Conditional rendering based on a bound variable                     |
| `@each`      | Loop over a data array, rendering children once per item            |
| `@bind`      | Two-way binding between a form field and a named variable           |
| `@on:click`  | Attach a click handler expression to the nearest element            |
| `@event`     | Declare a named custom event that the page can emit                 |
| `@agent`     | Invoke an AI agent inline and render its structured output          |

---

## Renderer Contract

A conforming VML renderer must satisfy all of the following:

- Output a single `.html` file per `.vml` source file.
- All CSS and JavaScript must be inlined; no external URLs in rendered output.
- Rendering must be **deterministic**: identical input produces byte-for-byte identical output.
- Unknown commands must produce a render error, not silent fallback.
- `@import` paths are resolved relative to the source file, not the working directory.
- Output files are written to the `/docs` directory by default.

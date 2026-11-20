# omp-rich-copy

An OMP extension that copies the latest assistant reply to the system clipboard as both rich HTML and plain Markdown. Outlook, OneNote, Word, and other rich-text applications can consume the HTML representation; plain-text applications receive the original Markdown.

## Supported platforms

- macOS: writes `public.html` and `public.utf8-plain-text` through `NSPasteboard`.
- Windows: writes `HTML Format` (CF_HTML) and `UnicodeText` through the Windows Forms clipboard API. Windows PowerShell or PowerShell 7 is required.
- Linux: not currently supported because clipboard ownership and MIME support differ between X11 and Wayland.

## Install from this checkout

Link the repository as a user plugin:

```sh
omp plugin link --scope user /absolute/path/to/omp-rich-copy
```

Alternatively, add the repository path to `~/.omp/agent/config.yml`:

```yaml
extensions:
  - /absolute/path/to/omp-rich-copy
```

For one session only:

```sh
omp --extension /absolute/path/to/omp-rich-copy
```

Restart OMP after installing the extension.

## Usage

After an assistant reply has completed:

```text
/copy-rich
```

The command copies text blocks from the latest assistant message. Thinking and tool-call blocks are excluded.

## Security behavior

The extension uses OMP's existing behavior-compatible Marked implementation from `@oh-my-pi/pi-utils/marked`; it does not add a Markdown parser dependency.

Before placing HTML on the clipboard, it:

- escapes raw HTML;
- allows only HTTP, HTTPS, and mailto links;
- removes image sources and renders image alt text instead;
- falls back to escaped text if Markdown parsing fails.

Clipboard helpers receive a JSON payload over standard input. The macOS helper uses the system Swift runtime and AppKit. The Windows helper uses PowerShell and `System.Windows.Forms`; it does not invoke user-supplied shell text.

## Development

```sh
bun install
bun run check
```

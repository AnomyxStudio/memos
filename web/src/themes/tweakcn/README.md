# TweakCN Theme Imports

Place imported theme CSS files in this folder to make them available in the theme selector.

Quick start (from `web/`):

```bash
pnpm tweakcn:import --name "My Theme" --in /path/to/theme.css
```

Install directly from a TweakCN/shadcn registry URL:

```bash
pnpm tweakcn:add https://tweakcn.com/r/themes/claude.json
```

The importer accepts either:

- Theme JSON (from TweakCN/shadcn registry), or
- Raw CSS with `:root` variables.

For CSS input, it expects:

- A `:root { ... }` block with CSS variables.
- An optional `.dark { ... }` block for a separate dark variant.

It writes:

- `src/themes/tweakcn/<name>.css`
- `src/themes/tweakcn/<name>-dark.css` (if a dark block exists)

To add themes manually, drop a `.css` file in this folder that defines a `:root` block. The file name becomes the theme value. Use a `-dark` suffix for dark variants so the app treats them as dark.

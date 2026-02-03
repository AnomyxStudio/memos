# TweakCN Theme Imports

Place imported theme CSS files in this folder to make them available in the theme selector.

Quick start (from `web/`):

```bash
bun tweakcn:import --name "My Theme" --in /path/to/theme.css
```

The importer expects:

- A `:root { ... }` block with CSS variables.
- An optional `.dark { ... }` block for a separate dark variant.

It writes:

- `src/themes/tweakcn/<name>.css`
- `src/themes/tweakcn/<name>-dark.css` (if a dark block exists)

To add themes manually, drop a `.css` file in this folder that defines a `:root` block. The file name becomes the theme value. Use a `-dark` suffix for dark variants so the app treats them as dark.

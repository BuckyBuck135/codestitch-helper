# Change Log

## 2.0.0

### MAJOR RELEASE - Framework Separation Architecture with Astro Support

**New Features:**

- #fc5ae2c Adds comprehensive Astro project support with image optimization via `<Picture />` component
- #ec6f3f3 Adds smart project type detection for Eleventy and Astro projects
- #ec6f3f3 Adds project type validation with warnings when selecting mismatched type
- #ec6f3f3 Adds enhanced sidebar UI with project type toggle and framework-specific actions
- #ec6f3f3 Adds organized command architecture with `eleventy/`, `astro/`, `shared/` separation
- #6f8ea77 Adds batch remote image download via command palette, sidebar, or CodeLens with multi-select UI
- #6f8ea77 Adds "Download Remote Image" CodeLens for individual image downloads with automatic import handling
- #6f8ea77 Adds "Choose Local Image" CodeLens to replace remote URLs with local file picker
- #564d37a Adds Astro SVG icon optimization via astro-icon components with "Convert to Icon" CodeLens
- #564d37a Adds "Download Remote SVGs" command with modern VSCode UI flow and multi-select checkboxes

**Improvements:**

- #6f8ea77 Improves Eleventy Sharp plugin path normalization to handle relative and absolute paths correctly
- #6f8ea77 Improves Astro image optimization to check for existing imports and prevent duplicates
- #0885add Improves all download commands to skip existing files instead of creating duplicates with `-1`, `-2` suffixes
- #ec6f3f3 Improves activation performance by removing wildcard activation events

**Bug Fixes:**

- #6f8ea77 Fixes Eleventy Sharp Images plugin detection to check package.json dependency name
- #e7f3a85 Fixes "Go to Styling" command navigation for Astro files
- #c682084 Fixes double installation when Sharp Images plugin already configured
- # Fixes edge case of handling multiple unique images in picture elements

**Breaking Changes:**

Command IDs have been renamed with framework prefixes:
- `codestitchHelper.replaceNavTabs` → `codestitchHelper.eleventy.replaceNavTabs`
- `codestitchHelper.optimizeSharpImages` → `codestitchHelper.eleventy.optimizeImages`
- `codestitchHelper.setupEleventySharpImages` → `codestitchHelper.eleventy.setupSharpImages`
- `codestitchHelper.optimizeAstroImages` → `codestitchHelper.astro.optimizeImages`

**Other Changes:**

- #ec6f3f3 Renames all files to camelCase convention
- #564d37a Renames "Download SVG Assets" to "Download Remote SVGs" for consistency
- #7fec663 Adds bugs URL for issue reporting
- #7fec663 Adds untrustedWorkspaces capability declaration
- #a62fb1b Removes non-functional "Optimise Site" sidebar button

## 1.3.0

- Adds "Download SVG Assets" command to download all SVGs from CDN and save locally

## 1.2.2

- Fixes styling navigation to wrong directory

## 1.2.1

- Adds warning when optimizing images without Sharp integration setup

## 1.2.0

- Adds button to optimize stylesheet links
- Adds button to navigate to CodeStitch website from HTML components
- Adds command to reorder styles to match HTML structure and remove unused sections

## 1.1.0

- Adds stitch ID display in navigator
- Fixes "Go to Styling" button navigating to incorrect directory instead of /src

## 1.0.0

- Adds optimize images for Sharp integration
- Adds button to quickly add code for Sharp integration
- Adds button to navigate to component styling

## 0.0.10

- Adjusts 11ty navigation replacement to use span element instead of button to avoid additional styling requirements

## 0.0.9

- Adds button to convert forms into Netlify compatible format

## 0.0.8

- Adds "Add cs-icon class" CodeLens for SVGs without the class

## 0.0.7

- Adds navigator for HTML and Nunjucks files

## 0.0.6

- Adds functionality to make navigation lists 11ty compliant with CodeLens

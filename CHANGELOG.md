# Change Log

## 2.0.0

### MAJOR RELEASE - Framework Separation Architecture for Astro Support

**New Features:**
- ✨ **Astro Support** - Sets up support for Astro projects with image optimization.
- 🎯 **Smart Project Detection** - Auto-detects Eleventy or Astro projects
- 🔒 **Project Type Validation** - Warns when selecting mismatched project type
- 🎨 **Enhanced Sidebar UI** - Project type toggle with framework-specific actions
- 📁 **Organized Architecture** - Commands separated into `eleventy/`, `astro/`, and `shared/` folders

**Breaking Changes:**
- Command IDs have been renamed with framework prefixes:
  - `codestitchHelper.replaceNavTabs` → `codestitchHelper.eleventy.replaceNavTabs`
  - `codestitchHelper.optimizeSharpImages` → `codestitchHelper.eleventy.optimizeImages`
  - `codestitchHelper.setupEleventySharpImages` → `codestitchHelper.eleventy.setupSharpImages`
  - `codestitchHelper.optimizeAstroImages` → `codestitchHelper.astro.optimizeImages`

**Performance Improvements:**
- Activation events optimized (removed `*` wildcard)
- Extension only activates for relevant file types

**Other Changes:**
- All files renamed to camelCase convention
- Added `bugs` URL for issue reporting
- Added `untrustedWorkspaces` capability declaration
- The 'Optimise Site' button in the sidebar was not wired to any command. Replaced it with 'Download SVG assets' command.

## 1.3.0

* Added "Download SVG Assets" command. Downloads all SVGS from CDN and adds them to local file directory.

## 1.2.2

* Fix styling navigating to wrong directory

## 1.2.1

* Show a warning if users optimizes an image without having the sharp integration set up

## 1.2.0

* Added button to optimize stylesheet link
* Added button to HTML component to navigate to CodeStitch website
* Added command to reorder styles to correlate with HTML / remove unused style sections from file

## 1.1.0

* Display stitch ID in navigator
* Fixed a bug where "Go to Styling" button would sometimes navigate to incorrect directory, not /src

## 1.0.0

- Added optimize images for sharp integration
- Added button to quickly add code needed for sharp integration
- Added button to navigate to the styling of a component

## 0.0.10

* Adjusted the 11ty navigation replacement code to not use a `button `element, and a span, to not require additional styling.

## 0.0.9

- Added button to convert form into netlify compatible form

## 0.0.8

- Added "Add cs-icon class" CodeLens to SVGs which do not have it

## 0.0.7

- Added navigator for HTML/nunjucks files

## 0.0.6

- Added functionality to make Nav list 11ty compliant with CodeLens

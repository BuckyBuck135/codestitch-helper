# CodeStitch Helper (Unofficial)

CodeStitch Helper is a custom VSCode extension designed to streamline working with HTML, SVG, and form elements in your project, providing handy utilities for converting forms, replacing navigation structures, and adding CSS classes to SVG tags.

## Features

### 1. Add `cs-icon` Class to SVG Tags

The `addIconClass` function finds an `<svg>` tag in a document and adds a `cs-icon` class. If the SVG tag already has a `class` attribute, it appends `cs-icon` to the existing class. If there is no `class` attribute, it creates one with the `cs-icon` class.

### 2. Convert Forms to Netlify-Compatible Forms

The `convertToNetlifyForm` function scans the document for `<form>` elements and converts them into Netlify-compatible forms by adding the `data-netlify="true"` attribute. Additionally, it inserts a reCAPTCHA div before the form’s submit button for Netlify’s reCAPTCHA integration.

### 3. Replace Navigation Tabs with 11ty-Compatible Markup

The `replaceNavTabs` function finds the `<div class="cs-ul-wrapper">` element in the document and replaces its contents with a navigation structure compatible with the 11ty static site generator.

### 4. Select All Sections in Document

The `selectAll` function selects all the content between sections in the document. It uses regex to identify sections and their corresponding lines, then selects everything between them.

### 5. CodeLens Integration

The `CodeLensProvider` adds actionable lenses for common tasks:

- Convert `<form>` tags to Netlify-compatible forms.
- Add `cs-icon` class to SVG elements.
- Replace navigation wrappers with 11ty-compatible markup.

### 6. Section Navigation

The `SectionNavigationProvider` allows users to quickly jump between sections of the document, especially helpful for large files with numerous sections marked by comments or headings.

### 7. Download SVG Assets
The `codestitchHelper.downloadSvgAssets` command allows the user to download SVG assets and quickly modify the src paths in batch. It can be used from the command palette or the extension sidebar.

## Installation

1. Open Visual Studio Code.
2. Navigate to the Extensions view by clicking the Extensions icon in the Activity Bar on the side of the window.
3. Search for `CodeStitch Helper` in the search bar.
4. Click `Install` to install the extension.

Alternatively, you can install directly from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=NeuDigital.codestitch-helper).

## Commands

- `codestitchHelper.addIconClass`: Adds the `cs-icon` class to SVG tags.
- `codestitchHelper.convertToNetlifyForm`: Converts forms to Netlify-compatible versions.
- `codestitchHelper.replaceNavTabs`: Replaces navigation markup with 11ty-compatible structures.
- `codestitchHelper.selectAll`: Selects all content between defined sections in the document.
- `codestitchHelper.openSection`: Opens a specific section in the editor.

## Planned Featured

- [X] Show stitch ID in styling and HTML navigator
- [X] Reorder style file to match HTML file
- [X] Button to open browser to CodeStitch stitch
- [X] Button to optimize linking stylesheet
- [X] Add a button to quickly jump to CSS file / line of a stitch
- [X] Download all SVG assets from CDN into local files
- [ ] Find all unoptimized images
- [ ] Optimization checklist
- [ ] Convert all emails, phones, and address to use {{client}} syntax
- [ ] Easy re-order of pages using 11ty navigation
- [ ] Add honeypot field to form button
- [ ] Color 11ty / nunjucks code differently
- [ ] Remove dark mode command
- [ ] Purge styles when HTML is modified, e.g. removing a button
- [ ] Make li / item dynamic using 11ty
- [ ] Astro support

## License

MIT License

# CodeStitch Helper (Unofficial)

CodeStitch Helper is a VSCode extension designed to streamline working with CodeStitch components in both **Eleventy (11ty)** and **Astro** projects. It provides framework-specific optimizations and shared utilities for working with HTML, CSS, forms, and images.

## 🚀 Getting Started

### Installation

1. Open Visual Studio Code
2. Navigate to the Extensions view (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for `CodeStitch Helper`
4. Click `Install`

Alternatively, install directly from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=NeuDigital.codestitch-helper).

### First Use

When you open an Eleventy or Astro project, the extension will:
1. **Auto-detect** your project type based on config files and dependencies
2. Display a notification showing the detected project type
3. Load framework-specific commands for your project

You can manually change the project type anytime via the **CodeStitch Helper** sidebar.

## 📋 Features

### 🎯 Framework-Specific Features

#### **Eleventy Projects**
- **Replace Nav Tabs** - Convert static navigation to 11ty dynamic markup with `eleventyNavigation`
- **Optimize Images** - Convert `<picture>` elements to use Sharp Images plugin with `getUrl` filters
- **Setup Sharp Images** - Quickly install and configure the Sharp Images plugin for your project

#### **Astro Projects**
- **Optimize Images** - Convert `<picture>` elements to use Astro's `<Picture>` component
- **Image Picker UI** - Select images from your assets folder with alt text input
- **Import Management** - Automatically adds imports to frontmatter

### 🔧 Shared Features (Available in All Projects)

1. **Add `cs-icon` Class to SVGs** - Automatically adds the `cs-icon` class to SVG elements
2. **Convert to Netlify Forms** - Converts forms to Netlify-compatible format with reCAPTCHA integration
3. **Section Navigation** - Navigate between CodeStitch sections in large files
4. **Go to Styling** - Jump directly from HTML section to its CSS definition
5. **Optimize Stylesheets** - Convert stylesheet links to inline critical CSS
6. **Download SVG Assets** - Batch download SVG assets from CDN to local files
7. **Reorder Sections** - Reorganize CSS sections to match HTML structure
8. **Open in CodeStitch** - Quick link to view components on CodeStitch website

### 💡 CodeLens Integration

The extension adds inline action buttons (CodeLenses) above relevant code:
- `<form>` tags → "Convert to Netlify Form"
- `<svg>` tags → "Add cs-icon class"
- `<picture>` tags → "Optimize Images" (framework-aware)
- `<div class="cs-ul-wrapper">` → "Make compatible with 11ty" (Eleventy only)
- `<section id="...">` → "Go to Styling"
- `<link rel="stylesheet">` → "Optimize Stylesheet"

### 🎨 Enhanced Sidebar

Access the CodeStitch Helper sidebar from the Activity Bar:
- **Project Type Toggle** - Switch between Eleventy and Astro modes
- **Framework Actions** - Quick access to framework-specific commands
- **General Actions** - Download SVG assets and more

## 📝 Commands

### Eleventy Commands
- `CodeStitch Helper: Eleventy: Replace Static Tabs with Dynamic Tabs`
- `CodeStitch Helper: Eleventy: Optimize Images`
- `CodeStitch Helper: Eleventy: Set up Sharp Images`

### Astro Commands
- `CodeStitch Helper: Astro: Optimize Images`

### Shared Commands
- `CodeStitch Helper: Add cs-icon class to svg`
- `CodeStitch Helper: Convert Form to Netlify Form with reCAPTCHA`
- `CodeStitch Helper: Download SVG Assets`
- `CodeStitch Helper: Reorder Sections`
- `CodeStitch Helper: Set Project Type (Eleventy/Astro)`

Access commands via:
- Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
- CodeLens buttons above relevant code
- Context menu (right-click)
- Extension sidebar


## 🗺️ Roadmap

### Completed ✅
- [X] Show stitch ID in styling and HTML navigator
- [X] Reorder style file to match HTML file
- [X] Button to open browser to CodeStitch stitch
- [X] Button to optimize linking stylesheet
- [X] Add a button to quickly jump to CSS file / line of a stitch
- [X] Download all SVG assets from CDN into local files
- [X] Astro support

### Planned 🚧
- [ ] Implement a proper test suite
- [ ] Find all unoptimized images
- [ ] Optimization checklist
- [ ] Convert all emails, phones, and addresses to use {{client}} syntax
- [ ] Easy re-order of pages using 11ty navigation
- [ ] Add honeypot field to form button
- [ ] Remove dark mode command
- [ ] Purge styles when HTML is modified (e.g., removing a button)
- [ ] Make list items dynamic using 11ty
- [ ] Add support for transforming SVGs into `<Icon />` with astro-icon
- [ ] Fix `optimise stylesheet` for Astro

## 🐛 Issues & Feedback

Found a bug or have a feature request? [Open an issue](https://github.com/calebneuf/codestitch-helper/issues) on GitHub.

## 📄 License

MIT License

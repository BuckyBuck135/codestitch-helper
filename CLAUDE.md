# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CodeStitch Helper is a VSCode extension that provides utilities for web developers working with HTML, CSS, and the CodeStitch framework. It supports both **Eleventy** and **Astro** projects with framework-specific optimizations and shared utilities for form conversion, SVG optimization, and more.

## Development Commands

### Build and Compilation
- `npm run compile` - Compile TypeScript to JavaScript
- `npm run watch` - Watch for changes and compile automatically
- `npm run vscode:prepublish` - Prepare extension for publishing

### Testing and Quality
- `npm run lint` - Run ESLint on source code
- `npm run test` - Run extension tests
- `npm run pretest` - Compile and lint before testing

## Architecture

### Core Structure
- `src/extension.ts` - Main extension entry point with conditional command registration
- `src/commands/eleventy/` - Eleventy-specific commands (replaceNavTabs, optimizeSharpImages, setupEleventySharpImages)
- `src/commands/astro/` - Astro-specific commands (optimizeAstroImages)
- `src/commands/shared/` - Framework-agnostic commands (addIconClass, convertToNetlifyForm, etc.)
- `src/providers/` - VSCode providers (codeLensProvider, sectionNavigationProvider, sidebarProvider)
- `src/services/` - Core services (projectTypeManager)
- `src/utils/` - Utility functions (sectionUtils, astroTransform, importLexer)

### Key Components
- **ProjectTypeManager** - Manages project type detection, validation, and state
- **SectionNavigationProvider** - Powers the CSS sections navigator tree view
- **CodeLensProvider** - Adds framework-aware actionable code lenses above HTML elements
- **SidebarProvider** - Custom webview sidebar with project type toggle and framework-specific actions

### Framework-Specific Features

**Eleventy:**
- Replace navigation tabs with 11ty dynamic markup
- Optimize images with Sharp plugin integration
- Setup Sharp Images plugin command

**Astro:**
- Optimize images with Astro Picture component
- Import management for Astro components
- Alt text input during image optimization

**Shared:**
- Form conversion to Netlify format with reCAPTCHA
- SVG class addition (`cs-icon`)
- Section reordering and navigation
- Asset downloading and optimization
- Navigate to CSS styling from HTML sections

## File Patterns
- Processes HTML, CSS, SCSS, Sass, Less, Astro, and Nunjucks files
- Looks for comment-delimited sections like `/*-- -------------------------- -->    #ID-1234    <-- ------------------------------ --*/`
- Supports both CSS and HTML section patterns
- All files use camelCase naming convention

## Testing Extension
Compile `tsc -p ./` after every change before
Use F5 in VSCode to launch Extension Development Host for testing changes.
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CodeStitch Helper is a VSCode extension that provides utilities for web developers working with HTML, CSS, and the CodeStitch framework. It automates common tasks like form conversion, SVG optimization, and 11ty integration.

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
- `src/extension.ts` - Main extension entry point, registers all commands and providers
- `src/commands/` - Individual command implementations (replaceNavTabs, convertToNetlifyForm, etc.)
- `src/providers/` - VSCode providers (CodeLens, TreeView, Sidebar)  
- `src/utils/` - Utility functions for section parsing and common operations
- `src/views/` - HTML templates for webview interfaces

### Key Components
- **SectionNavigationProvider** - Powers the CSS sections navigator tree view
- **CodeLensProvider** - Adds actionable code lenses above HTML elements
- **SidebarProvider** - Custom webview sidebar with optimization tools
- **Section parsing** - Extracts and manages CSS/HTML sections marked with comment blocks

### Extension Registration
All commands are registered in `extension.ts` activate function:
- Form conversion to Netlify format with reCAPTCHA
- SVG class addition (`cs-icon`)
- Navigation tab replacement for 11ty
- Section reordering and navigation
- Asset downloading and optimization

## File Patterns
- Processes HTML, CSS, SCSS, and Nunjucks files
- Looks for comment-delimited sections like `/*-- -------------------------- -->    #ID-1234    <-- ------------------------------ --*/`
- Supports both CSS and HTML section patterns

## Testing Extension
Use F5 in VSCode to launch Extension Development Host for testing changes.
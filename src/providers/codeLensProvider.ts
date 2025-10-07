import * as vscode from "vscode";
import { navigateToSectionCSSCommandId } from "../commands/shared/navigateToSectionCSS";
import { ProjectTypeManager } from "../services/projectTypeManager";

export class CodeLensProvider implements vscode.CodeLensProvider {
  onDidChangeCodeLenses?: vscode.Event<void> | undefined;

  constructor(private readonly projectTypeManager: ProjectTypeManager) {}

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();
    let match: RegExpExecArray | null;

    // Regex to find the <div class="cs-ul-wrapper"> line (Eleventy only)
    if (this.projectTypeManager.isEleventy()) {
      const divPattern = /<div class="cs-ul-wrapper">[\s\S]*?<\/div>/g;
      while ((match = divPattern.exec(text)) !== null) {
        const startPosition = document.positionAt(match.index);
        const endPosition = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPosition, endPosition);

        codeLenses.push(
          new vscode.CodeLens(range, {
            title: "Make compatible with 11ty",
            command: "codestitchHelper.eleventy.replaceNavTabs",
            arguments: [document],
          })
        );
      }
    }

    const formPattern = /<form[\s\S]*?>/g;
    while ((match = formPattern.exec(text)) !== null) {
      const startPosition = document.positionAt(match.index);
      const endPosition = document.positionAt(match.index + match[0].length); // Find the full <form> tag
      const range = new vscode.Range(startPosition, endPosition);

      // Create a new CodeLens above the form tag
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: "Convert to Netlify Form",
          command: "codestitchHelper.convertToNetlifyForm",
          arguments: [document],
        })
      );
    }

    // Regex to find <svg> tags without the class "cs-icon"
    const svgPattern = /<svg([^>]*?)>/g;
    while ((match = svgPattern.exec(text)) !== null) {
      const startPosition = document.positionAt(match.index);
      const endPosition = document.positionAt(match.index + match[0].length); // Find the full <svg> tag
      const range = new vscode.Range(startPosition, endPosition);

      // Check if the svg tag already has the cs-icon class
      if (!match[0].includes('class="cs-icon"')) {
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: "Add cs-icon class",
            command: "codestitchHelper.addIconClass",
            arguments: [document, range],
          })
        );
      }
    }

    // Regex to find any <picture> tags regardless of attributes
    const picturePattern = /<picture\b[^>]*>[\s\S]*?<\/picture>/g;
    while ((match = picturePattern.exec(text)) !== null) {
      const startPosition = document.positionAt(match.index);
      const endPosition = document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPosition, endPosition);

      // Show optimization based on project type
      if (this.projectTypeManager.isEleventy()) {
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: "Optimize Images",
            command: "codestitchHelper.eleventy.optimizeImages",
            arguments: [document, range],
          })
        );
      } else if (this.projectTypeManager.isAstro()) {
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: "Optimize Images",
            command: "codestitchHelper.astro.optimizeImages",
            arguments: [document, range],
          })
        );
      }
    }

    // Regex to find <section> tags with an id attribute
    const sectionPattern = /<section[^>]*id="([^"]+)"[^>]*>/g;
    while ((match = sectionPattern.exec(text)) !== null) {
      const startPosition = document.positionAt(match.index);
      const endPosition = document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPosition, endPosition);

      // Create a new CodeLens above the section tag
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: "Go to Styling",
          command: navigateToSectionCSSCommandId,
          arguments: [document, range],
        })
      );
    }

    // Add this to your existing patterns in provideCodeLenses
    const linkPattern =
      /<link\s+rel=["']stylesheet["']\s+href=["'][^"']+["']\s*\/?>/g;
    while ((match = linkPattern.exec(text)) !== null) {
      // Check if this link is inside a noscript tag
      const upToMatch = text.slice(0, match.index);
      const lastNoscriptStart = upToMatch.lastIndexOf("<noscript");
      const lastNoscriptEnd = upToMatch.lastIndexOf("</noscript");

      // Skip if we're inside a noscript tag
      if (lastNoscriptStart > lastNoscriptEnd) {
        continue;
      }

      const startPosition = document.positionAt(match.index);
      const endPosition = document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPosition, endPosition);

      codeLenses.push(
        new vscode.CodeLens(range, {
          title: "Optimize Stylesheet",
          command: "codestitchHelper.optimizeStylesheet",
          arguments: [document, match[0]],
        })
      );
    }

    const sectionIdPattern = /section\s+id="[a-zA-Z-]*(\d+)"/g;
    while ((match = sectionIdPattern.exec(text)) !== null) {
      const startPosition = document.positionAt(match.index);
      const endPosition = document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPosition, endPosition);
      const numberId = match[1]; // This will capture only the numeric portion

      codeLenses.push(
        new vscode.CodeLens(range, {
          title: "Open in CodeStitch",
          command: "codestitchHelper.navigateToCodeStitch",
          arguments: [numberId],
        })
      );
    }

    return codeLenses;
  }
}

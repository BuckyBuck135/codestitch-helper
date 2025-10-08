import * as vscode from "vscode";
import { ProjectTypeManager } from "../services/projectTypeManager";

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "codestitchHelper";
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _projectTypeManager: ProjectTypeManager
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.command) {
        case "downloadSvgAssets": {
          vscode.commands.executeCommand("codestitchHelper.downloadSvgAssets");
          break;
        }
        case "downloadRemoteImages": {
          vscode.commands.executeCommand("codestitchHelper.downloadRemoteImages");
          break;
        }
        case "setProjectType": {
          const newType = data.projectType as "eleventy" | "astro";
          const validation = await this._projectTypeManager.validateProjectType(
            newType
          );

          if (!validation.matches && validation.detected !== "unknown") {
            // Detected project type doesn't match the requested type
            const detectedName =
              validation.detected === "eleventy" ? "Eleventy" : "Astro";
            const requestedName = newType === "eleventy" ? "Eleventy" : "Astro";

            const choice = await vscode.window.showWarningMessage(
              `⚠️ This appears to be an ${detectedName} project, but you're trying to set it as ${requestedName}. Are you sure?`,
              {
                modal: true,
                detail: `We detected ${detectedName} configuration files or dependencies in your workspace. Using the wrong project type may cause commands to fail or behave unexpectedly.`,
              },
              "Yes, Override"
            );

            if (choice !== "Yes, Override") {
              // User cancelled, refresh the webview to reset the radio button
              if (this._view) {
                this._view.webview.html = this._getHtmlForWebview(
                  this._view.webview
                );
              }
              break;
            }
          }

          await this._projectTypeManager.setProjectType(newType);
          vscode.window
            .showInformationMessage(
              `Project type changed to ${newType === "eleventy" ? "Eleventy" : "Astro"}. Extension reload required.`,
              "Reload Now",
              "Later"
            )
            .then((selection) => {
              if (selection === "Reload Now") {
                vscode.commands.executeCommand("workbench.action.reloadWindow");
              }
            });
          break;
        }
        case "setupSharpImages": {
          vscode.commands.executeCommand(
            "codestitchHelper.eleventy.setupSharpImages"
          );
          break;
        }
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const projectType = this._projectTypeManager.getProjectType();
    const isEleventy = projectType === "eleventy";
    const isAstro = projectType === "astro";
    const isUnknown = projectType === "unknown";

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width,initial-scale=1.0">
          <title>CodeStitch Helper</title>
          <style>
            body {
              padding: 10px;
              font-family: var(--vscode-font-family);
            }

            .section {
              margin-bottom: 20px;
              padding-bottom: 15px;
              border-bottom: 1px solid var(--vscode-panel-border);
            }

            .section:last-child {
              border-bottom: none;
            }

            h3 {
              margin: 0 0 10px 0;
              font-size: 13px;
              font-weight: 600;
              color: var(--vscode-foreground);
            }

            .project-type-info {
              margin-bottom: 10px;
              padding: 8px;
              background: var(--vscode-textBlockQuote-background);
              border-left: 3px solid var(--vscode-textLink-foreground);
              font-size: 12px;
            }

            .project-type-info.unknown {
              border-left-color: var(--vscode-editorWarning-foreground);
            }

            .radio-group {
              display: flex;
              flex-direction: column;
              gap: 8px;
              margin-bottom: 10px;
            }

            .radio-option {
              display: flex;
              align-items: center;
              gap: 8px;
              cursor: pointer;
              padding: 6px;
              border-radius: 3px;
            }

            .radio-option:hover {
              background: var(--vscode-list-hoverBackground);
            }

            .radio-option input[type="radio"] {
              cursor: pointer;
            }

            .radio-option label {
              cursor: pointer;
              flex: 1;
            }

            button {
              width: 100%;
              padding: 8px;
              margin: 4px 0;
              background: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
              border: none;
              border-radius: 2px;
              cursor: pointer;
              font-size: 12px;
            }

            button:hover {
              background: var(--vscode-button-hoverBackground);
            }

            button:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }

            .framework-actions {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }
          </style>
        </head>
        <body>
          <div class="section">
            <h3>Project Type</h3>
            <div class="project-type-info ${isUnknown ? "unknown" : ""}">
              Current: <strong>${isUnknown ? "Unknown" : isEleventy ? "Eleventy" : "Astro"}</strong>
              ${isUnknown ? "<br><small>⚠️ Please select your project type</small>" : ""}
            </div>

            <div class="radio-group">
              <div class="radio-option">
                <input
                  type="radio"
                  id="eleventy"
                  name="projectType"
                  value="eleventy"
                  ${isEleventy ? "checked" : ""}
                >
                <label for="eleventy">Eleventy Project</label>
              </div>

              <div class="radio-option">
                <input
                  type="radio"
                  id="astro"
                  name="projectType"
                  value="astro"
                  ${isAstro ? "checked" : ""}
                >
                <label for="astro">Astro Project</label>
              </div>
            </div>
          </div>

          ${
            isEleventy
              ? `
          <div class="section">
            <h3>Eleventy Actions</h3>
            <div class="framework-actions">
              <button id="setupSharpImages">Setup Sharp Images Plugin</button>
            </div>
          </div>
          `
              : ""
          }

          ${
            isAstro
              ? `
          <div class="section">
            <h3>Astro Actions</h3>
            <div class="framework-actions">
              <p style="font-size: 12px; color: var(--vscode-descriptionForeground);">
                Astro-specific actions coming soon...
              </p>
            </div>
          </div>
          `
              : ""
          }

          <div class="section">
            <h3>General Actions</h3>
            <div class="framework-actions">
              <button id="downloadRemoteImages">Download Remote Images</button>
              <button id="downloadSvgAssets">Download SVG Assets</button>
            </div>
          </div>

          <script>
            const vscode = acquireVsCodeApi();

            // Project type radio buttons
            document.querySelectorAll('input[name="projectType"]').forEach(radio => {
              radio.addEventListener('change', (e) => {
                vscode.postMessage({
                  command: 'setProjectType',
                  projectType: e.target.value
                });
              });
            });

            // Download Remote Images button
            const downloadImagesBtn = document.getElementById('downloadRemoteImages');
            if (downloadImagesBtn) {
              downloadImagesBtn.addEventListener('click', () => {
                vscode.postMessage({ command: 'downloadRemoteImages' });
              });
            }

            // Download SVG Assets button
            const downloadBtn = document.getElementById('downloadSvgAssets');
            if (downloadBtn) {
              downloadBtn.addEventListener('click', () => {
                vscode.postMessage({ command: 'downloadSvgAssets' });
              });
            }

            // Setup Sharp Images button (Eleventy only)
            const setupBtn = document.getElementById('setupSharpImages');
            if (setupBtn) {
              setupBtn.addEventListener('click', () => {
                vscode.postMessage({ command: 'setupSharpImages' });
              });
            }
          </script>
        </body>
      </html>
    `;
  }
}

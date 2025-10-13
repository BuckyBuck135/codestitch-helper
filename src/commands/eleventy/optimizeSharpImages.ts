import path from "path";
import * as vscode from "vscode";
import { promises as fs } from "fs";

let isSharpImagesPluginInstalled: boolean | null = null;

/**
 * Normalizes any local path to Sharp plugin format (/assets/images/...)
 * Handles: /src/assets/images/hero.jpg, ../assets/images/hero.jpg, ./assets/images/hero.jpg
 * Output: /assets/images/hero.jpg
 */
function normalizeToSharpPath(imagePath: string, workspaceRoot: string): string {
  // Remove leading ./ if present
  let normalizedPath = imagePath.replace(/^\.\//, "");

  // If it's a relative path (../) or absolute path, we need to resolve it
  if (normalizedPath.startsWith("../") || path.isAbsolute(normalizedPath)) {
    // For relative paths, we can't resolve without knowing the source file location
    // So we'll look for the /assets/images/ pattern
    const assetsMatch = normalizedPath.match(/\/assets\/images\/.+$/);
    if (assetsMatch) {
      return assetsMatch[0];
    }
  }

  // If path starts with /src/, strip it
  if (normalizedPath.startsWith("/src/")) {
    normalizedPath = normalizedPath.substring(4); // Remove "/src"
  } else if (normalizedPath.startsWith("src/")) {
    normalizedPath = normalizedPath.substring(3); // Remove "src"
    if (!normalizedPath.startsWith("/")) {
      normalizedPath = "/" + normalizedPath;
    }
  }

  // Ensure it starts with /
  if (!normalizedPath.startsWith("/")) {
    normalizedPath = "/" + normalizedPath;
  }

  return normalizedPath;
}

export async function optimizeSharpImages(
  document: vscode.TextDocument,
  range: vscode.Range
) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {return;}

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage("No workspace folder is open.");
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const text = document.getText(range);

  let converted = text;

  // Match each src or srcset individually (now including relative paths)
  const regex = /(src|srcset)="([^"]+\.(jpg|JPG|jpeg|png|webp))"/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0];
    const attr = match[1];
    const imagePath = match[2];

    // Skip if it's a remote URL (shouldn't happen, but safety check)
    if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
      continue;
    }

    // Normalize the path to Sharp plugin format
    const normalizedPath = normalizeToSharpPath(imagePath, workspaceRoot);

    // Determine the tag enclosing this src or srcset
    const tagStartIndex = text.lastIndexOf("<", match.index);
    const tagEndIndex = text.indexOf(">", match.index) + 1;
    const tagText = text.substring(tagStartIndex, tagEndIndex);

    let width: number | null = null;
    let height: number | null = null;

    // Extract dimensions from the <img> tag
    const imgTagMatch = text.match(/<img[^>]*>/);
    let originalWidth: number | null = null;
    let originalHeight: number | null = null;

    if (imgTagMatch) {
      const imgTag = imgTagMatch[0];
      const widthMatch = imgTag.match(/width="(\d+)"/);
      const heightMatch = imgTag.match(/height="(\d+)"/);
      originalWidth = widthMatch ? parseInt(widthMatch[1], 10) : null;
      originalHeight = heightMatch ? parseInt(heightMatch[1], 10) : null;
    }

    if (/^<source\b/.test(tagText)) {
      // It's a <source> tag
      const mediaMatch = tagText.match(/media="([^"]+)"/);
      if (mediaMatch) {
        const mediaQuery = mediaMatch[1];
        if (/\(max-width:\s*600px\)/.test(mediaQuery)) {
          // Mobile-specific dimensions
          if (originalWidth !== null) {
            width = Math.min(originalWidth, 600);
          } else {
            width = 600; // Default to 600 if width not found
          }
          height = originalHeight; // Use the same height as the original image
        } else {
          // Use original dimensions
          width = originalWidth;
          height = originalHeight;
        }
      }
    } else if (/^<img\b/.test(tagText)) {
      // It's an <img> tag
      width = originalWidth;
      height = originalHeight;
    }

    // Set default dimensions if none found
    if (width === null) {width = 1000;}
    if (height === null) {height = 1000;}

    // Construct the resize parameters
    let resizeParams = `{width: ${width}`;
    if (height !== null) {
      resizeParams += `, height: ${height}`;
    }
    resizeParams += `}`;

    // Construct the replacement using normalized path
    const replacement = `${attr}="{% getUrl '${normalizedPath}' | resize(${resizeParams}) | avif %}"`;

    // Replace only this specific instance in the converted text
    converted = converted.replace(fullMatch, replacement);
  }

  if (isSharpImagesPluginInstalled === null) {
    isSharpImagesPluginInstalled = await checkIfSharpImagesPluginInstalled();
    if (!isSharpImagesPluginInstalled) {
      vscode.window
        .showWarningMessage(
          "Sharp Images plugin is not installed.",
          "Install Now"
        )
        .then((selection) => {
          if (selection === "Install Now") {
            vscode.commands.executeCommand(
              "codestitchHelper.setupEleventySharpImages"
            );
          }
        });
    }
  }

  await editor.edit((editBuilder) => {
    editBuilder.replace(range, converted);
  });
}

async function checkIfSharpImagesPluginInstalled(): Promise<boolean> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return false;
  }

  const workspacePath = workspaceFolders[0].uri.fsPath;

  // Check package.json for the plugin dependency
  const packageJsonPath = path.join(workspacePath, "package.json");
  try {
    const packageJsonData = await fs.readFile(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonData);

    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};

    const hasPluginDependency =
      "@codestitchofficial/eleventy-plugin-sharp-images" in dependencies ||
      "@codestitchofficial/eleventy-plugin-sharp-images" in devDependencies;

    if (!hasPluginDependency) {
      return false;
    }
  } catch {
    // package.json not found or not readable
    return false;
  }

  // Check .eleventy.js for plugin configuration
  const eleventyConfigPath = path.join(workspacePath, ".eleventy.js");
  try {
    const eleventyConfigData = await fs.readFile(eleventyConfigPath, "utf8");

    if (!eleventyConfigData.includes("@codestitchofficial/eleventy-plugin-sharp-images")) {
      return false;
    }
  } catch {
    // .eleventy.js not found or not readable
    return false;
  }

  // Plugin is installed and configured
  return true;
}

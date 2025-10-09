import * as vscode from "vscode";
import * as path from "path";
import { getDefaultImagesDirectory, getRelativeImportPath } from "../../utils/imageDownloader";
import { ProjectTypeManager } from "../../services/projectTypeManager";
import { urlToVariableName } from "../../utils/astroTransform";
import { addImageImportToFrontmatter } from "../../utils/importLexer";

/**
 * Replaces a remote image URL with a local image selected by the user
 */
export async function replaceWithLocalImage(
	document: vscode.TextDocument,
	range: vscode.Range,
	projectTypeManager: ProjectTypeManager
) {
	const editor = vscode.window.activeTextEditor;
	if (!editor || editor.document.uri.toString() !== document.uri.toString()) {
		vscode.window.showErrorMessage("The active editor does not match the document.");
		return;
	}

	try {
		const text = document.getText(range);

		// Extract ALL remote image URLs from the tag
		const urlPattern = /(?:src|srcset)=["'](https?:\/\/[^"']+)["']/gi;
		const allUrls = new Set<string>();
		let match: RegExpExecArray | null;

		while ((match = urlPattern.exec(text)) !== null) {
			const url = match[1];
			// Check if it's a remote URL
			try {
				const urlObj = new URL(url);
				if (urlObj.protocol === "http:" || urlObj.protocol === "https:") {
					allUrls.add(url);
				}
			} catch {
				// Not a valid URL, skip
			}
		}

		if (allUrls.size === 0) {
			vscode.window.showErrorMessage("Could not find any remote image URLs in the selected element.");
			return;
		}

		// Convert to array for processing
		const remoteUrls = Array.from(allUrls);

		// Get workspace root and default images directory
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			vscode.window.showErrorMessage("No workspace folder is open.");
			return;
		}

		const workspaceRoot = workspaceFolders[0].uri.fsPath;
		const projectType = projectTypeManager.getProjectType();
		const defaultImagesDir = getDefaultImagesDirectory(workspaceRoot, projectType);
		const documentDir = path.dirname(document.uri.fsPath);

		// Map of remote URL to local image info
		const urlReplacements = new Map<string, { localPath: string; variableName: string; relativePath: string }>();

		// Prompt user to select a local image for each unique remote URL
		for (let i = 0; i < remoteUrls.length; i++) {
			const remoteUrl = remoteUrls[i];
			const urlFilename = path.basename(new URL(remoteUrl).pathname);
			const progress = remoteUrls.length > 1 ? ` (${i + 1} of ${remoteUrls.length})` : '';

			// Show file picker to select local image for this URL
			const imageUri = await vscode.window.showOpenDialog({
				filters: {
					Images: ["jpg", "jpeg", "png", "webp", "svg", "avif"],
				},
				defaultUri: vscode.Uri.file(defaultImagesDir),
				canSelectMany: false,
				openLabel: "Select Image",
				title: `Select local image for: ${urlFilename}${progress}`,
			});

			if (!imageUri || imageUri.length === 0) {
				vscode.window.showInformationMessage("Image selection cancelled.");
				return;
			}

			const selectedImagePath = imageUri[0].fsPath;
			const relativePath = getRelativeImportPath(selectedImagePath, documentDir);
			const variableName = urlToVariableName(selectedImagePath);

			urlReplacements.set(remoteUrl, {
				localPath: selectedImagePath,
				variableName,
				relativePath,
			});
		}

		// Update document with all replacements
		if (projectType === "astro") {
			// Astro: Add imports and use image object syntax
			const { parse } = await import("@astrojs/compiler");
			const { serialize, is } = await import("@astrojs/compiler/utils");

			const documentText = document.getText();
			const result = await parse(documentText);

			// Find or create frontmatter
			let frontmatterNode: any = null;
			for (const node of result.ast.children) {
				if (is.frontmatter(node)) {
					frontmatterNode = node;
					break;
				}
			}

			// Add all imports
			for (const [url, info] of urlReplacements) {
				if (frontmatterNode) {
					frontmatterNode.value = await addImageImportToFrontmatter(
						frontmatterNode.value,
						info.variableName,
						info.relativePath
					);
				} else {
					// Create new frontmatter with first import
					const newFrontmatter = {
						type: "frontmatter" as const,
						value: `\nimport ${info.variableName} from "${info.relativePath}";\n`,
						position: {
							start: { line: 1, column: 1, offset: 0 },
							end: { line: 1, column: 1, offset: 0 },
						},
					};
					result.ast.children.unshift(newFrontmatter as any);
					frontmatterNode = newFrontmatter; // Use this for subsequent imports
				}
			}

			// Replace remote URLs with {variableName.src} in the HTML
			let newContent = serialize(result.ast);

			for (const [url, info] of urlReplacements) {
				const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				newContent = newContent.replace(
					new RegExp(`((?:src|srcset)=)["']${escapedUrl}["']`, "gi"),
					`$1{${info.variableName}.src}`
				);
			}

			// Replace entire document
			await editor.edit((editBuilder) => {
				const fullRange = new vscode.Range(
					document.positionAt(0),
					document.positionAt(documentText.length)
				);
				editBuilder.replace(fullRange, newContent);
			});
		} else {
			// Eleventy: Replace with relative paths
			let updatedText = text;

			for (const [url, info] of urlReplacements) {
				const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				updatedText = updatedText.replace(
					new RegExp(escapedUrl, "g"),
					info.relativePath
				);
			}

			await editor.edit((editBuilder) => {
				editBuilder.replace(range, updatedText);
			});
		}

		const replaceMessage = remoteUrls.length > 1
			? `✓ Replaced ${remoteUrls.length} images`
			: `✓ Image replaced: ${path.basename(urlReplacements.values().next().value.localPath)}`;
		vscode.window.showInformationMessage(replaceMessage);
	} catch (error) {
		vscode.window.showErrorMessage(
			`Failed to replace image: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

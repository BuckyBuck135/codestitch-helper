import * as vscode from "vscode";
import * as path from "path";
import { downloadRemoteImage, isRemoteImageUrl, getDefaultImagesDirectory, getRelativeImportPath } from "../../utils/imageDownloader";
import { ProjectTypeManager } from "../../services/projectTypeManager";
import { urlToVariableName } from "../../utils/astroTransform";
import { addImageImportToFrontmatter } from "../../utils/importLexer";

/**
 * Downloads a single remote image and replaces the URL in the document
 */
export async function downloadImage(document: vscode.TextDocument, range: vscode.Range, projectTypeManager: ProjectTypeManager) {
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
			if (isRemoteImageUrl(url)) {
				allUrls.add(url);
			}
		}

		if (allUrls.size === 0) {
			vscode.window.showErrorMessage("Could not find any remote image URLs in the selected element.");
			return;
		}

		// Convert to array for display
		const imageUrls = Array.from(allUrls);

		// Get workspace root
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			vscode.window.showErrorMessage("No workspace folder is open.");
			return;
		}

		const workspaceRoot = workspaceFolders[0].uri.fsPath;
		const projectType = projectTypeManager.getProjectType();

		// Get default save directory
		const defaultSaveDir = getDefaultImagesDirectory(workspaceRoot, projectType);

		// Prompt user to select save directory once
		const saveUri = await vscode.window.showOpenDialog({
			canSelectFolders: true,
			canSelectFiles: false,
			openLabel: "Select directory to save images",
			defaultUri: vscode.Uri.file(defaultSaveDir),
		});

		if (!saveUri || saveUri.length === 0) {
			vscode.window.showInformationMessage("Image download cancelled.");
			return;
		}

		const saveDirectory = saveUri[0].fsPath;

		// Map of remote URL to local image info
		const urlReplacements = new Map<string, { localPath: string; variableName: string; relativePath: string }>();

		// Download each unique image
		const downloadResults = await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: `Downloading ${imageUrls.length} image${imageUrls.length > 1 ? 's' : ''}...`,
				cancellable: false,
			},
			async (progress) => {
				let successCount = 0;
				let skippedCount = 0;
				let failedCount = 0;

				for (let i = 0; i < imageUrls.length; i++) {
					const imageUrl = imageUrls[i];
					const urlFilename = path.basename(new URL(imageUrl).pathname);

					progress.report({
						increment: (i / imageUrls.length) * 100,
						message: `${i + 1}/${imageUrls.length}: ${urlFilename}`,
					});

					try {
						// Download the image
						const result = await downloadRemoteImage(imageUrl, saveDirectory);

						if (!result.success || !result.localPath) {
							failedCount++;
							continue;
						}

						if (result.skipped) {
							skippedCount++;
						} else {
							successCount++;
						}

						// Calculate relative path and variable name for this image
						const documentDir = path.dirname(document.uri.fsPath);
						const relativePath = getRelativeImportPath(result.localPath, documentDir);
						const variableName = urlToVariableName(result.localPath);

						urlReplacements.set(imageUrl, {
							localPath: result.localPath,
							variableName,
							relativePath,
						});
					} catch (error) {
						console.error(`Failed to download ${imageUrl}:`, error);
						failedCount++;
					}
				}

				return { successCount, skippedCount, failedCount };
			}
		);

		if (urlReplacements.size === 0) {
			vscode.window.showErrorMessage("Failed to download any images.");
			return;
		}

		// Update document with all replacements
		if (projectType === "astro") {
			// Astro: Add imports and use image object syntax
			const { parse } = await import("@astrojs/compiler");
			const { serialize, is } = await import("@astrojs/compiler/utils");

			const documentText = document.getText();
			const astroResult = await parse(documentText);

			// Find or create frontmatter
			let frontmatterNode: any = null;
			for (const node of astroResult.ast.children) {
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
					astroResult.ast.children.unshift(newFrontmatter as any);
					frontmatterNode = newFrontmatter; // Use this for subsequent imports
				}
			}

			// Replace remote URLs with {variableName.src} in the HTML
			let newContent = serialize(astroResult.ast);

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

		// Show success notification
		const summary = [
			downloadResults.successCount > 0 ? `✓ ${downloadResults.successCount} downloaded` : null,
			downloadResults.skippedCount > 0 ? `⊘ ${downloadResults.skippedCount} skipped (already exist)` : null,
			downloadResults.failedCount > 0 ? `✗ ${downloadResults.failedCount} failed` : null
		].filter(Boolean).join(" | ");

		vscode.window.showInformationMessage(summary);
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to download remote image: ${error instanceof Error ? error.message : String(error)}`);
	}
}

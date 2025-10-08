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

		// Extract the image URL from the tag
		const urlMatch = text.match(/(?:src|srcset)=["'](https?:\/\/[^"']+)["']/i);
		if (!urlMatch) {
			vscode.window.showErrorMessage("Could not find a remote image URL in the selected element.");
			return;
		}

		const imageUrl = urlMatch[1];

		// Verify it's a remote URL
		if (!isRemoteImageUrl(imageUrl)) {
			vscode.window.showErrorMessage("The image URL is not a remote URL.");
			return;
		}

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

		// Prompt user to select save directory
		const saveUri = await vscode.window.showOpenDialog({
			canSelectFolders: true,
			canSelectFiles: false,
			openLabel: "Select directory to save image",
			defaultUri: vscode.Uri.file(defaultSaveDir),
		});

		if (!saveUri || saveUri.length === 0) {
			vscode.window.showInformationMessage("Image download cancelled.");
			return;
		}

		const saveDirectory = saveUri[0].fsPath;

		// Show progress and download
		const downloadResult = await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: "Downloading image...",
				cancellable: false,
			},
			async (progress) => {
				progress.report({ increment: 0, message: "Starting download..." });

				// Download the image
				const result = await downloadRemoteImage(imageUrl, saveDirectory, {
					onProgress: (downloaded, total) => {
						const percentage = Math.round((downloaded / total) * 100);
						progress.report({
							increment: percentage,
							message: `${percentage}%`,
						});
					},
				});

				if (!result.success || !result.localPath) {
					throw new Error(result.error || "Download failed");
				}

				progress.report({ increment: 100, message: "Updating references..." });

				// Calculate relative path from document to downloaded image
				const documentDir = path.dirname(document.uri.fsPath);
				const relativePath = getRelativeImportPath(result.localPath, documentDir);

				if (projectType === "astro") {
					// Astro: Add import and use image object syntax
					const variableName = urlToVariableName(result.localPath);

					// Parse Astro document
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

					if (frontmatterNode) {
						// Add import to existing frontmatter
						frontmatterNode.value = await addImageImportToFrontmatter(
							frontmatterNode.value,
							variableName,
							relativePath
						);
					} else {
						// Create new frontmatter with import
						const newFrontmatter = {
							type: "frontmatter" as const,
							value: `\nimport ${variableName} from "${relativePath}";\n`,
							position: {
								start: { line: 1, column: 1, offset: 0 },
								end: { line: 1, column: 1, offset: 0 },
							},
						};
						astroResult.ast.children.unshift(newFrontmatter as any);
					}

					// Replace remote URLs with {variableName.src} in the HTML
					let newContent = serialize(astroResult.ast);

					// Replace all occurrences of remote URL with {variableName.src}
					newContent = newContent.replace(
						new RegExp(`((?:src|srcset)=)["']${imageUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "gi"),
						`$1{${variableName}.src}`
					);

					// Replace entire document
					await editor.edit((editBuilder) => {
						const fullRange = new vscode.Range(
							document.positionAt(0),
							document.positionAt(documentText.length)
						);
						editBuilder.replace(fullRange, newContent);
					});
				} else {
					// Eleventy: Just replace with relative path
					let updatedText = text;

					// Replace all occurrences of the URL
					updatedText = updatedText.replace(
						new RegExp(imageUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
						relativePath
					);

					await editor.edit((editBuilder) => {
						editBuilder.replace(range, updatedText);
					});
				}

				return {
					localPath: result.localPath,
					filename: path.basename(result.localPath),
				};
			}
		);

		// Show success notification
		vscode.window.showInformationMessage(`✓ Download complete: ${downloadResult.filename}`);
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to download remote image: ${error instanceof Error ? error.message : String(error)}`);
	}
}

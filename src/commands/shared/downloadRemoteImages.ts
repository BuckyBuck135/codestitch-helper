import * as vscode from "vscode";
import * as path from "path";
import { downloadRemoteImage, findRemoteImageUrls, getDefaultImagesDirectory, getRelativeImportPath, RemoteImage } from "../../utils/imageDownloader";
import { ProjectTypeManager } from "../../services/projectTypeManager";

interface ImageDownloadSelection {
	url: string;
	label: string;
	description: string;
	picked: boolean;
	image: RemoteImage;
}

/**
 * Downloads multiple remote images from the current file or selected directory
 */
export async function downloadRemoteImages(projectTypeManager: ProjectTypeManager) {
	try {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			vscode.window.showErrorMessage("No workspace folder is open.");
			return;
		}

		const workspaceRoot = workspaceFolders[0].uri.fsPath;
		const projectType = projectTypeManager.getProjectType();

		// Ask user to choose scope: current file or directory
		const scopeChoice = await vscode.window.showQuickPick(
			[
				{
					label: "$(file) Current File",
					description: "Scan only the active file",
					scope: "file",
				},
				{
					label: "$(folder) Select Directory",
					description: "Scan all HTML/Astro files in a directory",
					scope: "directory",
				},
			],
			{
				placeHolder: "Choose scan scope",
			}
		);

		if (!scopeChoice) {
			return;
		}

		let filesToScan: vscode.Uri[] = [];

		if (scopeChoice.scope === "file") {
			const activeEditor = vscode.window.activeTextEditor;
			if (!activeEditor) {
				vscode.window.showErrorMessage("No active file open.");
				return;
			}
			filesToScan = [activeEditor.document.uri];
		} else {
			// Prompt for directory selection
			const directoryUri = await vscode.window.showOpenDialog({
				canSelectFolders: true,
				canSelectFiles: false,
				openLabel: "Select directory to scan",
				defaultUri: workspaceFolders[0].uri,
			});

			if (!directoryUri || directoryUri.length === 0) {
				vscode.window.showInformationMessage("Directory selection cancelled.");
				return;
			}

			// Determine file pattern based on project type
			let filePattern = "**/*.html";
			if (projectType === "astro") {
				filePattern = "**/*.{html,astro}";
			} else if (projectType === "eleventy") {
				filePattern = "**/*.{html,njk,nunjucks}";
			}

			// Find all matching files in directory
			filesToScan = await vscode.workspace.findFiles(new vscode.RelativePattern(directoryUri[0], filePattern), "**/node_modules/**");

			if (filesToScan.length === 0) {
				vscode.window.showInformationMessage("No matching files found in directory.");
				return;
			}
		}

		// Scan files for remote images
		const allRemoteImages: Map<string, { image: RemoteImage; document: vscode.TextDocument }> = new Map();

		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: "Scanning for remote images...",
				cancellable: false,
			},
			async (progress) => {
				for (let i = 0; i < filesToScan.length; i++) {
					const file = filesToScan[i];
					progress.report({
						increment: (i / filesToScan.length) * 100,
						message: `${i + 1}/${filesToScan.length} files`,
					});

					const document = await vscode.workspace.openTextDocument(file);
					const remoteImages = findRemoteImageUrls(document);

					for (const image of remoteImages) {
						// Use URL as key to avoid duplicates
						if (!allRemoteImages.has(image.url)) {
							allRemoteImages.set(image.url, { image, document });
						}
					}
				}
			}
		);

		if (allRemoteImages.size === 0) {
			vscode.window.showInformationMessage("No remote images found.");
			return;
		}

		// Create selection items for QuickPick
		const imageSelections: ImageDownloadSelection[] = Array.from(allRemoteImages.values()).map(({ image, document }) => {
			const fileName = path.basename(document.uri.fsPath);
			const urlPreview = image.url.length > 50 ? image.url.substring(0, 47) + "..." : image.url;

			return {
				url: image.url,
				label: `$(globe) ${urlPreview}`,
				description: `in ${fileName}`,
				picked: true,
				image,
			};
		});

		// Show QuickPick with preview
		const selectedImages = await vscode.window.showQuickPick(imageSelections, {
			canPickMany: true,
			placeHolder: `Found ${allRemoteImages.size} remote image(s). Select images to download.`,
			matchOnDescription: true,
		});

		if (!selectedImages || selectedImages.length === 0) {
			vscode.window.showInformationMessage("No images selected for download.");
			return;
		}

		// Get default save directory
		const defaultSaveDir = getDefaultImagesDirectory(workspaceRoot, projectType);

		// Prompt for save directory
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

		// Download remote images (without modifying HTML)
		const results = await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: "Downloading images...",
				cancellable: false,
			},
			async (progress) => {
				const downloadResults: {
					success: number;
					failed: number;
					skipped: number;
				} = {
					success: 0,
					failed: 0,
					skipped: 0,
				};

				for (let i = 0; i < selectedImages.length; i++) {
					const selection = selectedImages[i];
					progress.report({
						increment: (i / selectedImages.length) * 100,
						message: `${i + 1}/${selectedImages.length}`,
					});

					try {
						// Download image
						const result = await downloadRemoteImage(selection.url, saveDirectory);

						if (!result.success || !result.localPath) {
							downloadResults.failed++;
							continue;
						}

						if (result.skipped) {
							downloadResults.skipped++;
						} else {
							downloadResults.success++;
						}
					} catch (error) {
						console.error(`Failed to download ${selection.url}:`, error);
						downloadResults.failed++;
					}
				}

				return downloadResults;
			}
		);

		// Show summary
		const summary = [
			results.success > 0 ? `✓ ${results.success} downloaded` : null,
			results.skipped > 0 ? `⊘ ${results.skipped} skipped (already exist)` : null,
			results.failed > 0 ? `✗ ${results.failed} failed` : null
		].filter(Boolean).join(" | ");

		vscode.window.showInformationMessage(summary);
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to download remote images: ${error instanceof Error ? error.message : String(error)}`);
	}
}

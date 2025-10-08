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

		// Extract the remote image URL from the tag
		const urlMatch = text.match(/(?:src|srcset)=["'](https?:\/\/[^"']+)["']/i);
		if (!urlMatch) {
			vscode.window.showErrorMessage("Could not find a remote image URL in the selected element.");
			return;
		}

		const remoteUrl = urlMatch[1];

		// Get workspace root and default images directory
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			vscode.window.showErrorMessage("No workspace folder is open.");
			return;
		}

		const workspaceRoot = workspaceFolders[0].uri.fsPath;
		const projectType = projectTypeManager.getProjectType();
		const defaultImagesDir = getDefaultImagesDirectory(workspaceRoot, projectType);

		// Show file picker to select local image
		const imageUri = await vscode.window.showOpenDialog({
			filters: {
				Images: ["jpg", "jpeg", "png", "webp", "svg", "avif"],
			},
			defaultUri: vscode.Uri.file(defaultImagesDir),
			canSelectMany: false,
			openLabel: "Select Image",
		});

		if (!imageUri || imageUri.length === 0) {
			vscode.window.showInformationMessage("Image selection cancelled.");
			return;
		}

		const selectedImagePath = imageUri[0].fsPath;
		const documentDir = path.dirname(document.uri.fsPath);
		const relativePath = getRelativeImportPath(selectedImagePath, documentDir);
		const filename = path.basename(selectedImagePath);

		if (projectType === "astro") {
			// Astro: Add import and use image object syntax
			const variableName = urlToVariableName(selectedImagePath);

			// Parse Astro document
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
				result.ast.children.unshift(newFrontmatter as any);
			}

			// Replace remote URLs with {variableName.src} in the HTML
			let newContent = serialize(result.ast);

			// Replace all occurrences of remote URL with {variableName.src}
			newContent = newContent.replace(
				new RegExp(`((?:src|srcset)=)["']${remoteUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "gi"),
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

			// Replace all occurrences of the remote URL
			updatedText = updatedText.replace(
				new RegExp(remoteUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
				relativePath
			);

			await editor.edit((editBuilder) => {
				editBuilder.replace(range, updatedText);
			});
		}

		vscode.window.showInformationMessage(`✓ Image replaced: ${filename}`);
	} catch (error) {
		vscode.window.showErrorMessage(
			`Failed to replace image: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

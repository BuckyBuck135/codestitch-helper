import * as vscode from "vscode";
import { calculateNewPicture, urlToVariableName, calculateRelativePath } from "../utils/astro-transform";
import { addPictureToFrontmatter, addPlaceholderImageToFrontmatter, addImageImportToFrontmatter } from "../utils/import-lexer";

// Helper to walk AST and find nodes
function walkNode(node: any, callback: (node: any) => void) {
	callback(node);
	if (node.children) {
		for (const child of node.children) {
			walkNode(child, callback);
		}
	}
}

// Helper to check if a position is within a node's range
function isPositionInNode(position: vscode.Position, node: any, document: vscode.TextDocument): boolean {
	if (!node.position) {
		return false;
	}
	const start = node.position.start;
	const end = node.position.end;

	// Convert 1-based line/column to 0-based Position
	const startPos = new vscode.Position(start.line - 1, start.column - 1);
	const endPos = new vscode.Position(end.line - 1, end.column - 1);

	return position.isAfterOrEqual(startPos) && position.isBeforeOrEqual(endPos);
}

export async function optimizeAstroImages(document: vscode.TextDocument, range: vscode.Range) {
	const editor = vscode.window.activeTextEditor;
	if (!editor || editor.document.uri.toString() !== document.uri.toString()) {
		vscode.window.showErrorMessage("The active editor does not match the document.");
		return;
	}

	try {
		// Show quick pick for image source selection
		const choice = await vscode.window.showQuickPick([
			{
				label: "$(file-media) Choose image from assets folder",
				description: "Pick your actual image now",
				action: "pick"
			},
			{
				label: "$(circle-slash) Use placeholder for now",
				description: "I'll set the image later",
				action: "placeholder"
			}
		], {
			placeHolder: "Select image source for Picture component"
		});

		// Default to placeholder if user dismisses or doesn't choose
		let srcVariableName = "placeholderImage";
		let imagePath = "../assets/images/placeholder-image.png";
		let useCustomImage = false;
		let altText = "";

		if (choice?.action === "pick") {
			// Open file picker
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			const defaultUri = workspaceFolder
				? vscode.Uri.joinPath(workspaceFolder.uri, "src/assets/images")
				: undefined;

			const imageUri = await vscode.window.showOpenDialog({
				filters: { 'Images': ['jpg', 'jpeg', 'png', 'webp', 'svg', 'avif'] },
				defaultUri: defaultUri,
				canSelectMany: false,
				openLabel: "Select Image"
			});

			if (imageUri && imageUri[0]) {
				// User selected an image
				useCustomImage = true;
				imagePath = calculateRelativePath(document.uri.fsPath, imageUri[0].fsPath);
				srcVariableName = urlToVariableName(imageUri[0].fsPath);

				// Prompt for alt text
				const userAltText = await vscode.window.showInputBox({
					prompt: "Enter alt text for the image (optional)",
					placeHolder: "Descriptive text for accessibility",
					value: ""
				});

				// If user dismisses or leaves blank, use empty string
				altText = userAltText ?? "";
			}
			// If user cancelled file picker, fall back to placeholder (already set above)
		}

		// Dynamically import ESM modules
		const { parse } = await import("@astrojs/compiler");
		const { serialize, is } = await import("@astrojs/compiler/utils");

		const documentText = document.getText();
		const result = await parse(documentText);

		let pictureNode: any = null;
		let frontmatterNode: any = null;

		// Walk the AST to find the picture element at the given range and frontmatter
		walkNode(result.ast, (node: any) => {
			if (is.frontmatter(node)) {
				frontmatterNode = node;
			} else if (is.element(node) && node.name === "picture" && isPositionInNode(range.start, node, document)) {
				pictureNode = node;
			}
		});

		if (!pictureNode) {
			vscode.window.showErrorMessage("No <picture> element found at the specified location.");
			return;
		}

		// Transform the picture node in place with chosen src variable and alt text
		const newNode = calculateNewPicture(pictureNode, srcVariableName, altText);
		(pictureNode as any).type = newNode.type;
		(pictureNode as any).name = newNode.name;
		(pictureNode as any).attributes = newNode.attributes;
		(pictureNode as any).children = newNode.children;

		// Update frontmatter to add Picture import and image import
		if (frontmatterNode) {
			let updatedValue = await addPictureToFrontmatter(frontmatterNode.value);
			if (useCustomImage) {
				updatedValue = await addImageImportToFrontmatter(updatedValue, srcVariableName, imagePath);
			} else {
				updatedValue = await addPlaceholderImageToFrontmatter(updatedValue);
			}
			frontmatterNode.value = updatedValue;
		} else {
			// No frontmatter exists, create it with imports
			let importStatements = '\nimport { Picture } from "astro:assets";\n';
			if (useCustomImage) {
				importStatements += `import ${srcVariableName} from "${imagePath}";\n`;
			} else {
				importStatements += 'import placeholderImage from "../assets/images/placeholder-image.png";\n';
			}

			const newFrontmatter = {
				type: "frontmatter" as const,
				value: importStatements,
				position: {
					start: { line: 1, column: 1, offset: 0 },
					end: { line: 1, column: 1, offset: 0 },
				},
			};
			// Insert frontmatter at the beginning of the AST
			result.ast.children.unshift(newFrontmatter as any);
		}

		// Serialize the updated AST back to string
		const newContent = serialize(result.ast);

		// Replace the entire document content
		await editor.edit((editBuilder) => {
			const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(documentText.length));
			editBuilder.replace(fullRange, newContent);
		});

		vscode.window.showInformationMessage("Optimized picture element for Astro!");
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to optimize: ${error}`);
	}
}

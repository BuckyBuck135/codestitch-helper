import * as vscode from "vscode";
import { calculateNewPicture } from "../utils/astro-transform";
import { addPictureToFrontmatter, addPlaceholderImageToFrontmatter } from "../utils/import-lexer";

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

		// Transform the picture node in place
		const newNode = calculateNewPicture(pictureNode);
		(pictureNode as any).type = newNode.type;
		(pictureNode as any).name = newNode.name;
		(pictureNode as any).attributes = newNode.attributes;
		(pictureNode as any).children = newNode.children;

		// Update frontmatter to add Picture import and placeholderImage import
		if (frontmatterNode) {
			let updatedValue = await addPictureToFrontmatter(frontmatterNode.value);
			updatedValue = await addPlaceholderImageToFrontmatter(updatedValue);
			frontmatterNode.value = updatedValue;
		} else {
			// No frontmatter exists, create it with both imports
			const newFrontmatter = {
				type: "frontmatter" as const,
				value: 'import { Picture } from "astro:assets";\nimport placeholderImage from "../assets/images/placeholder-image.png";',
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

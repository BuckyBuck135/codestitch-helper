import * as vscode from "vscode";
import { calculateNewPicture, urlToVariableName, calculateRelativePath } from "../../utils/astroTransform";
import { addPictureToFrontmatter, addPlaceholderImageToFrontmatter, addImageImportToFrontmatter } from "../../utils/importLexer";

interface ImageSourceSelection {
	srcVariableName: string;
	imagePath: string;
	useCustomImage: boolean;
	altText: string;
}

function walkNode(node: any, callback: (node: any) => void) {
	callback(node);
	if (node.children) {
		for (const child of node.children) {
			walkNode(child, callback);
		}
	}
}

function isPositionInNode(position: vscode.Position, node: any, document: vscode.TextDocument): boolean {
	if (!node.position) return false;

	const start = node.position.start;
	const end = node.position.end;
	const startPos = new vscode.Position(start.line - 1, start.column - 1);
	const endPos = new vscode.Position(end.line - 1, end.column - 1);

	return position.isAfterOrEqual(startPos) && position.isBeforeOrEqual(endPos);
}

async function promptForImageSource(document: vscode.TextDocument): Promise<ImageSourceSelection> {
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

	const defaultSelection: ImageSourceSelection = {
		srcVariableName: "placeholderImage",
		imagePath: "../assets/images/placeholder-image.png",
		useCustomImage: false,
		altText: ""
	};

	if (choice?.action !== "pick") {
		return defaultSelection;
	}

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

	if (!imageUri || !imageUri[0]) {
		return defaultSelection;
	}

	const userAltText = await vscode.window.showInputBox({
		prompt: "Enter alt text for the image (optional)",
		placeHolder: "Descriptive text for accessibility",
		value: ""
	});

	return {
		srcVariableName: urlToVariableName(imageUri[0].fsPath),
		imagePath: calculateRelativePath(document.uri.fsPath, imageUri[0].fsPath),
		useCustomImage: true,
		altText: userAltText ?? ""
	};
}

async function updateFrontmatterWithImports(
	frontmatterNode: any,
	result: any,
	useCustomImage: boolean,
	srcVariableName: string,
	imagePath: string
): Promise<void> {
	if (frontmatterNode) {
		let updatedValue = await addPictureToFrontmatter(frontmatterNode.value);
		if (useCustomImage) {
			updatedValue = await addImageImportToFrontmatter(updatedValue, srcVariableName, imagePath);
		} else {
			updatedValue = await addPlaceholderImageToFrontmatter(updatedValue);
		}
		frontmatterNode.value = updatedValue;
	} else {
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
		result.ast.children.unshift(newFrontmatter as any);
	}
}

export async function optimizeAstroImages(document: vscode.TextDocument, range: vscode.Range) {
	const editor = vscode.window.activeTextEditor;
	if (!editor || editor.document.uri.toString() !== document.uri.toString()) {
		vscode.window.showErrorMessage("The active editor does not match the document.");
		return;
	}

	try {
		const { srcVariableName, imagePath, useCustomImage, altText } = await promptForImageSource(document);

		const { parse } = await import("@astrojs/compiler");
		const { serialize, is } = await import("@astrojs/compiler/utils");

		const documentText = document.getText();
		const result = await parse(documentText);

		let pictureNode: any = null;
		let frontmatterNode: any = null;

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

		const newNode = calculateNewPicture(pictureNode, srcVariableName, altText);
		pictureNode.type = newNode.type;
		pictureNode.name = newNode.name;
		pictureNode.attributes = newNode.attributes;
		pictureNode.children = newNode.children;

		await updateFrontmatterWithImports(frontmatterNode, result, useCustomImage, srcVariableName, imagePath);

		const newContent = serialize(result.ast);

		await editor.edit((editBuilder) => {
			const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(documentText.length));
			editBuilder.replace(fullRange, newContent);
		});

		vscode.window.showInformationMessage("Optimized picture element for Astro!");
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to optimize: ${error}`);
	}
}

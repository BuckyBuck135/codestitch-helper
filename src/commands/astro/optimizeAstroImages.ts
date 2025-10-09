import * as vscode from "vscode";
import * as path from "path";
import { calculateNewPicture, urlToVariableName, calculateRelativePath } from "../../utils/astroTransform";
import { addPictureToFrontmatter, addImageImportToFrontmatter } from "../../utils/importLexer";
import { isRemoteImageUrl } from "../../utils/imageDownloader";

interface ImageSourceSelection {
	srcVariableName: string;
	imagePath: string;
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

/**
 * Extracts all src/srcset URLs from a picture element
 */
function extractAllImageUrls(text: string): string[] {
	const urls: string[] = [];

	// Match all src and srcset attributes
	const urlPattern = /(?:src|srcset)=(?:\{([^}]+)\.src\}|["']([^"']+)["'])/gi;
	let match: RegExpExecArray | null;

	while ((match = urlPattern.exec(text)) !== null) {
		// match[1] is for Astro syntax {var.src}, match[2] is for regular "url"
		const url = match[1] ? `{${match[1]}.src}` : match[2];
		if (url) {
			urls.push(url);
		}
	}

	return urls;
}

/**
 * Extracts local image path from a picture tag if it exists
 * Returns null if ANY image is still remote
 * Returns "ASTRO_IMPORTED" if ALL images use Astro import syntax
 * Returns a local path if ALL images are local but not imported
 */
function extractLocalImagePath(document: vscode.TextDocument, range: vscode.Range): string | null {
	const text = document.getText(range);
	const allUrls = extractAllImageUrls(text);

	if (allUrls.length === 0) {
		return null;
	}

	let hasAstroImported = false;
	let hasLocal = false;
	let hasRemote = false;
	let localPath: string | null = null;

	for (const url of allUrls) {
		if (url.startsWith('{') && url.endsWith('.src}')) {
			// Astro imported syntax
			hasAstroImported = true;
		} else if (isRemoteImageUrl(url)) {
			// Remote URL
			hasRemote = true;
		} else {
			// Local path
			hasLocal = true;
			if (!localPath) {
				localPath = url;
			}
		}
	}

	// If ANY image is still remote, return null (not ready to optimize)
	if (hasRemote) {
		return null;
	}

	// If ALL images use Astro import syntax
	if (hasAstroImported && !hasLocal) {
		return "ASTRO_IMPORTED";
	}

	// If ALL images are local paths (not imported yet)
	if (hasLocal && !hasAstroImported) {
		return localPath;
	}

	// Mixed state (some imported, some local but not imported) - treat as not ready
	return null;
}

/**
 * Prompts user for alt text only (no image selection)
 */
async function promptForAltTextOnly(): Promise<string> {
	const altText = await vscode.window.showInputBox({
		prompt: "Enter alt text for the image (optional)",
		placeHolder: "Descriptive text for accessibility",
		value: "",
	});

	return altText ?? "";
}

async function promptForImageSource(document: vscode.TextDocument): Promise<ImageSourceSelection | null> {
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
		return null;
	}

	const userAltText = await vscode.window.showInputBox({
		prompt: "Enter alt text for the image (optional)",
		placeHolder: "Descriptive text for accessibility",
		value: ""
	});

	return {
		srcVariableName: urlToVariableName(imageUri[0].fsPath),
		imagePath: calculateRelativePath(document.uri.fsPath, imageUri[0].fsPath),
		altText: userAltText ?? ""
	};
}

async function updateFrontmatterWithImports(
	frontmatterNode: any,
	result: any,
	srcVariableName: string,
	imagePath: string
): Promise<void> {
	if (frontmatterNode) {
		let updatedValue = await addPictureToFrontmatter(frontmatterNode.value);
		// Only add image import if imagePath is provided (not empty)
		if (imagePath) {
			updatedValue = await addImageImportToFrontmatter(updatedValue, srcVariableName, imagePath);
		}
		frontmatterNode.value = updatedValue;
	} else {
		// Only create image import if imagePath is provided
		const imageImport = imagePath ? `import ${srcVariableName} from "${imagePath}";\n` : '';
		const importStatements = `\nimport { Picture } from "astro:assets";\n${imageImport}`;

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
		// Check if picture already has a local image path
		const existingLocalPath = extractLocalImagePath(document, range);

		let srcVariableName: string;
		let imagePath: string;
		let altText: string;

		if (existingLocalPath === "ASTRO_IMPORTED") {
			// Picture already has imported image syntax (from "Choose Local" or "Download Remote")
			// Extract the variable name from the existing syntax and just prompt for alt text
			const text = document.getText(range);
			const astroImportMatch = text.match(/\{([^}]+)\.src\}/i);

			if (!astroImportMatch) {
				vscode.window.showErrorMessage("Could not extract variable name from imported image syntax.");
				return;
			}

			srcVariableName = astroImportMatch[1];
			altText = await promptForAltTextOnly();

			// We don't need imagePath since the import already exists
			imagePath = ""; // Will skip adding import later
		} else if (existingLocalPath) {
			// Picture has local path but not imported yet (shouldn't happen with new flow, but handle it)
			// Just prompt for alt text and use existing path
			altText = await promptForAltTextOnly();

			// Convert relative path to absolute for processing
			const documentDir = path.dirname(document.uri.fsPath);
			const absolutePath = path.resolve(documentDir, existingLocalPath);

			srcVariableName = urlToVariableName(absolutePath);
			imagePath = existingLocalPath; // Keep as relative path for import
		} else {
			// Picture still has remote URL, use full prompt
			const result = await promptForImageSource(document);

			if (!result) {
				vscode.window.showInformationMessage("Image selection cancelled.");
				return;
			}

			srcVariableName = result.srcVariableName;
			imagePath = result.imagePath;
			altText = result.altText;
		}

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

		await updateFrontmatterWithImports(frontmatterNode, result, srcVariableName, imagePath);

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

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { downloadRemoteImage, isRemoteImageUrl } from "../../utils/imageDownloader";
import { addIconToFrontmatter } from "../../utils/importLexer";

function walkNode(node: any, callback: (node: any) => void) {
	callback(node);
	if (node.children) {
		for (const child of node.children) {
			walkNode(child, callback);
		}
	}
}

function isPositionInNode(position: vscode.Position, node: any, document: vscode.TextDocument): boolean {
	if (!node.position) {return false;}

	const start = node.position.start;
	const end = node.position.end;
	const startPos = new vscode.Position(start.line - 1, start.column - 1);
	const endPos = new vscode.Position(end.line - 1, end.column - 1);

	return position.isAfterOrEqual(startPos) && position.isBeforeOrEqual(endPos);
}

/**
 * Transforms an img tag node to an Icon component node
 */
function calculateNewIcon(node: any): any {
	const { attributes } = node;

	const newAttributes: any[] = [];

	// Find the class attribute
	const classAttr = attributes.find((attr: any) => attr.name === "class");
	if (classAttr) {
		newAttributes.push({
			type: "attribute",
			kind: "quoted",
			name: "class",
			value: classAttr.value,
			raw: `"${classAttr.value}"`,
		});
	}

	// Note: name attribute will be added later after we download the SVG and know the filename

	return {
		type: "component",
		name: "Icon",
		attributes: newAttributes,
		children: [],
	};
}

/**
 * Transforms a remote SVG img tag to an Astro Icon component
 */
export async function transformSvgToIcon(document: vscode.TextDocument, range: vscode.Range) {
	const editor = vscode.window.activeTextEditor;
	if (!editor || editor.document.uri.toString() !== document.uri.toString()) {
		vscode.window.showErrorMessage("The active editor does not match the document.");
		return;
	}

	try {
		const text = document.getText(range);

		// Extract the SVG URL from the img tag
		const urlMatch = text.match(/src=["'](https?:\/\/[^"']+\.svg[^"']*)["']/i);
		if (!urlMatch) {
			vscode.window.showErrorMessage("Could not find a remote SVG URL in the selected element.");
			return;
		}

		const svgUrl = urlMatch[1];

		// Verify it's a remote URL
		if (!isRemoteImageUrl(svgUrl)) {
			vscode.window.showErrorMessage("The SVG URL is not a remote URL.");
			return;
		}

		// Get workspace root
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			vscode.window.showErrorMessage("No workspace folder is open.");
			return;
		}

		const workspaceRoot = workspaceFolders[0].uri.fsPath;

		// Default SVG save directory
		const defaultSaveDir = path.join(workspaceRoot, "src", "icons");

		// Check if SVG already exists or needs to be downloaded
		const urlObj = new URL(svgUrl);
		const filename = urlObj.pathname.split("/").pop() || "icon.svg";
		const expectedPath = path.join(defaultSaveDir, filename);

		// Show progress and download (if needed)
		const downloadResult = await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: "Processing SVG...",
				cancellable: false,
			},
			async (progress) => {
				let localPath: string;
				let wasDownloaded = false;

				// Check if file already exists
				if (fs.existsSync(expectedPath)) {
					// File exists, skip download
					progress.report({ increment: 50, message: "Using existing SVG..." });
					localPath = expectedPath;
				} else {
					// File doesn't exist, download it
					progress.report({ increment: 0, message: "Starting download..." });

					// Create directory if it doesn't exist
					if (!fs.existsSync(defaultSaveDir)) {
						fs.mkdirSync(defaultSaveDir, { recursive: true });
					}

					const result = await downloadRemoteImage(svgUrl, defaultSaveDir, {
						onProgress: (downloaded, total) => {
							const percentage = Math.round((downloaded / total) * 50);
							progress.report({
								increment: percentage,
								message: `${percentage}%`,
							});
						},
					});

					if (!result.success || !result.localPath) {
						throw new Error(result.error || "Download failed");
					}

					localPath = result.localPath;
					wasDownloaded = true;
				}

				progress.report({ increment: 100, message: "Transforming to Icon component..." });

				// Get the filename without extension for the Icon name attribute
				const iconName = path.basename(localPath).replace(path.extname(localPath), "");

				// Parse Astro document
				const { parse } = await import("@astrojs/compiler");
				const { serialize, is } = await import("@astrojs/compiler/utils");

				const documentText = document.getText();
				const astroResult = await parse(documentText);

				let imgNode: any = null;
				let frontmatterNode: any = null;

				walkNode(astroResult.ast, (node: any) => {
					if (is.frontmatter(node)) {
						frontmatterNode = node;
					} else if (is.element(node) && node.name === "img" && isPositionInNode(range.start, node, document)) {
						imgNode = node;
					}
				});

				if (!imgNode) {
					vscode.window.showErrorMessage("No <img> element found at the specified location.");
					return { iconName };
				}

				// Transform img to Icon component
				const newNode = calculateNewIcon(imgNode);

				// Add the name attribute with the icon filename
				newNode.attributes.unshift({
					type: "attribute",
					kind: "quoted",
					name: "name",
					value: iconName,
					raw: `"${iconName}"`,
				});

				// Update the node
				imgNode.type = newNode.type;
				imgNode.name = newNode.name;
				imgNode.attributes = newNode.attributes;
				imgNode.children = newNode.children;

				// Add Icon import to frontmatter
				if (frontmatterNode) {
					frontmatterNode.value = await addIconToFrontmatter(frontmatterNode.value);
				} else {
					// Create new frontmatter with Icon import
					const newFrontmatter = {
						type: "frontmatter" as const,
						value: `\nimport { Icon } from "astro-icon/components";\n`,
						position: {
							start: { line: 1, column: 1, offset: 0 },
							end: { line: 1, column: 1, offset: 0 },
						},
					};
					astroResult.ast.children.unshift(newFrontmatter as any);
				}

				// Serialize and update document
				const newContent = serialize(astroResult.ast);

				await editor.edit((editBuilder) => {
					const fullRange = new vscode.Range(
						document.positionAt(0),
						document.positionAt(documentText.length)
					);
					editBuilder.replace(fullRange, newContent);
				});

				return { iconName, wasDownloaded };
			}
		);

		// Show success notification
		if (downloadResult.wasDownloaded) {
			vscode.window.showInformationMessage(`✓ Converted to <Icon name="${downloadResult.iconName}" />. Restart dev server if icon doesn't appear.`);
		} else {
			vscode.window.showInformationMessage(`✓ Converted to <Icon name="${downloadResult.iconName}" /> (using existing SVG).`);
		}
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to transform SVG: ${error instanceof Error ? error.message : String(error)}`);
	}
}

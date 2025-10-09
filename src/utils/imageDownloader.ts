import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { promises as fsPromises } from "fs";

export interface DownloadOptions {
	overwrite?: boolean;
	onProgress?: (bytesDownloaded: number, totalBytes: number) => void;
}

export interface DownloadResult {
	success: boolean;
	localPath?: string;
	error?: string;
	skipped?: boolean;
}

export interface RemoteImage {
	url: string;
	range: vscode.Range;
	tagType: "img" | "picture";
	context: string; // Snippet of surrounding code for preview
}

/**
 * Downloads an image from a URL and saves it to a local directory
 * @param url - The URL of the image to download
 * @param imageDir - The directory to save the image to
 * @param options - Optional download options
 * @returns The download result with local file path or error
 */
export async function downloadRemoteImage(
	url: string,
	imageDir: string,
	options: DownloadOptions = {}
): Promise<DownloadResult> {
	try {
		// Create directory if it doesn't exist
		if (!fs.existsSync(imageDir)) {
			await fsPromises.mkdir(imageDir, { recursive: true });
		}

		// Extract filename from URL
		const urlObj = new URL(url);
		const filename = urlObj.pathname.split("/").pop() || "image";
		const extension = path.extname(filename) || ".jpg";
		const baseFilename = filename.replace(path.extname(filename), "");

		// Create a safe filename
		const safeFilename = sanitizeFilename(`${baseFilename}${extension}`);
		let localPath = path.join(imageDir, safeFilename);

		// Skip download if file already exists (unless overwrite is true)
		if (fs.existsSync(localPath) && !options.overwrite) {
			return {
				success: true,
				localPath,
				skipped: true,
			};
		}

		// Download the image
		await downloadFile(url, localPath, options.onProgress);

		return {
			success: true,
			localPath,
			skipped: false,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Downloads a file from URL to local path
 */
function downloadFile(
	url: string,
	dest: string,
	onProgress?: (bytesDownloaded: number, totalBytes: number) => void
): Promise<void> {
	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(dest);
		const protocol = url.startsWith("https") ? https : http;

		protocol
			.get(url, (response) => {
				if (response.statusCode === 301 || response.statusCode === 302) {
					// Handle redirects
					const redirectUrl = response.headers.location;
					if (redirectUrl) {
						file.close();
						fs.unlinkSync(dest);
						downloadFile(redirectUrl, dest, onProgress)
							.then(resolve)
							.catch(reject);
						return;
					}
				}

				if (response.statusCode !== 200) {
					file.close();
					fs.unlinkSync(dest);
					reject(
						new Error(
							`Failed to download: ${response.statusCode} ${response.statusMessage}`
						)
					);
					return;
				}

				const totalBytes = parseInt(response.headers["content-length"] || "0", 10);
				let downloadedBytes = 0;

				response.on("data", (chunk) => {
					downloadedBytes += chunk.length;
					if (onProgress && totalBytes > 0) {
						onProgress(downloadedBytes, totalBytes);
					}
				});

				response.pipe(file);
				file.on("finish", () => {
					file.close();
					resolve();
				});
			})
			.on("error", (err) => {
				file.close();
				if (fs.existsSync(dest)) {
					fs.unlinkSync(dest);
				}
				reject(err);
			});

		file.on("error", (err) => {
			file.close();
			if (fs.existsSync(dest)) {
				fs.unlinkSync(dest);
			}
			reject(err);
		});
	});
}

/**
 * Sanitizes a filename by replacing invalid characters
 */
function sanitizeFilename(filename: string): string {
	return filename.replace(/[<>:"\/\\|?*\s]/g, "_");
}

/**
 * Gets a unique file path by appending numbers if file exists
 */
function getUniqueFilePath(dir: string, filename: string): string {
	const extension = path.extname(filename);
	const baseName = filename.replace(extension, "");
	let counter = 1;
	let newPath = path.join(dir, filename);

	while (fs.existsSync(newPath)) {
		newPath = path.join(dir, `${baseName}-${counter}${extension}`);
		counter++;
	}

	return newPath;
}

/**
 * Checks if a URL is a remote image URL
 * @param url - The URL to check
 * @returns True if it's a remote image URL
 */
export function isRemoteImageUrl(url: string): boolean {
	try {
		const urlObj = new URL(url);
		return urlObj.protocol === "http:" || urlObj.protocol === "https:";
	} catch {
		return false;
	}
}

/**
 * Converts a URL to a valid variable name for imports
 * @param url - The URL to convert
 * @returns A valid variable name
 */
export function urlToImportName(url: string): string {
	try {
		const urlObj = new URL(url);
		const pathname = urlObj.pathname;

		// If pathname is just "/" or empty, use "image"
		if (pathname === "/" || pathname === "") {
			return "image";
		}

		const filename = pathname.split("/").pop();

		// If no filename or no extension, use "image"
		if (!filename || !filename.includes(".")) {
			return "image";
		}

		const title = filename.split(".")[0];
		if (!title) return "image";

		// Convert kebab-case and snake_case to camelCase
		// Remove non-alphanumeric characters except hyphens and underscores first
		let cleanTitle = title.replace(/[^a-zA-Z0-9-_]/g, "");

		// Convert to camelCase
		cleanTitle = cleanTitle.replace(/[-_]([a-zA-Z0-9])/g, (match, char) =>
			char.toUpperCase()
		);

		// Ensure it starts with a letter or underscore (valid JS identifier)
		if (/^[0-9]/.test(cleanTitle)) {
			cleanTitle = "img" + cleanTitle;
		}

		return cleanTitle || "image";
	} catch {
		// If URL parsing fails, fallback to simple string processing
		return "image";
	}
}

/**
 * Converts a local file path to a relative import path
 * @param filePath - The local file path
 * @param fromDir - The directory to calculate the relative path from
 * @returns The relative import path
 */
export function getRelativeImportPath(filePath: string, fromDir: string): string {
	const relativePath = path.relative(fromDir, filePath).replace(/\\/g, "/");
	// Ensure the path starts with ./ or ../
	if (!relativePath.startsWith("./") && !relativePath.startsWith("../")) {
		return `./${relativePath}`;
	}
	return relativePath;
}

/**
 * Finds all remote image URLs in a document
 * @param document - The VSCode document to scan
 * @returns Array of remote images found
 */
export function findRemoteImageUrls(document: vscode.TextDocument): RemoteImage[] {
	const text = document.getText();
	const remoteImages: RemoteImage[] = [];

	// Pattern for img tags with remote URLs
	const imgPattern = /<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
	let match: RegExpExecArray | null;

	while ((match = imgPattern.exec(text)) !== null) {
		const url = match[1];
		const startPos = document.positionAt(match.index);
		const endPos = document.positionAt(match.index + match[0].length);
		const range = new vscode.Range(startPos, endPos);

		// Get context (surrounding lines)
		const lineStart = Math.max(0, startPos.line - 1);
		const lineEnd = Math.min(document.lineCount - 1, endPos.line + 1);
		const context = document.getText(
			new vscode.Range(lineStart, 0, lineEnd, Number.MAX_SAFE_INTEGER)
		);

		remoteImages.push({
			url,
			range,
			tagType: "img",
			context: context.trim(),
		});
	}

	// Pattern for picture tags with remote URLs in source or img
	const picturePattern = /<picture[^>]*>[\s\S]*?<\/picture>/gi;
	while ((match = picturePattern.exec(text)) !== null) {
		const pictureContent = match[0];
		const urlMatches = pictureContent.match(/(?:src|srcset)=["'](https?:\/\/[^"']+)["']/gi);

		if (urlMatches && urlMatches.length > 0) {
			// Extract all unique URLs from the picture element
			const uniqueUrls = new Set<string>();
			for (const urlMatch of urlMatches) {
				const url = urlMatch.match(/https?:\/\/[^"']+/)?.[0];
				if (url) {
					uniqueUrls.add(url);
				}
			}

			// Create a RemoteImage entry for each unique URL found
			const startPos = document.positionAt(match.index);
			const endPos = document.positionAt(match.index + match[0].length);
			const range = new vscode.Range(startPos, endPos);

			// Get context
			const lineStart = Math.max(0, startPos.line - 1);
			const lineEnd = Math.min(document.lineCount - 1, endPos.line + 1);
			const context = document.getText(
				new vscode.Range(lineStart, 0, lineEnd, Number.MAX_SAFE_INTEGER)
			);

			for (const url of uniqueUrls) {
				remoteImages.push({
					url,
					range,
					tagType: "picture",
					context: context.trim(),
				});
			}
		}
	}

	return remoteImages;
}

/**
 * Finds all remote SVG URLs in a document
 * @param document - The VSCode document to scan
 * @returns Array of remote SVGs found
 */
export function findRemoteSvgUrls(document: vscode.TextDocument): RemoteImage[] {
	const text = document.getText();
	const remoteSvgs: RemoteImage[] = [];

	// Pattern for any SVG URLs (in img tags, inline, etc.)
	const svgPattern = /https?:\/\/[^'"\s]+\.svg\b/gi;
	let match: RegExpExecArray | null;

	while ((match = svgPattern.exec(text)) !== null) {
		const url = match[0];
		const startPos = document.positionAt(match.index);
		const endPos = document.positionAt(match.index + match[0].length);
		const range = new vscode.Range(startPos, endPos);

		// Get context (surrounding lines)
		const lineStart = Math.max(0, startPos.line - 1);
		const lineEnd = Math.min(document.lineCount - 1, endPos.line + 1);
		const context = document.getText(
			new vscode.Range(lineStart, 0, lineEnd, Number.MAX_SAFE_INTEGER)
		);

		remoteSvgs.push({
			url,
			range,
			tagType: "img", // Most SVGs will be in img tags
			context: context.trim(),
		});
	}

	return remoteSvgs;
}

/**
 * Gets the default images directory based on project type
 * @param projectRoot - The workspace root path
 * @param projectType - The project type (eleventy or astro)
 * @returns The default images directory path
 */
export function getDefaultImagesDirectory(
	projectRoot: string,
	projectType: "eleventy" | "astro" | "unknown"
): string {
	if (projectType === "astro") {
		return path.join(projectRoot, "src", "assets", "images");
	} else if (projectType === "eleventy") {
		return path.join(projectRoot, "src", "assets", "images");
	} else {
		// Unknown project type, default to src/assets/images
		return path.join(projectRoot, "src", "assets", "images");
	}
}

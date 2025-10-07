function insertIntoImport(code: string, imp: { ss: number; se: number }, importName: string): string {
	const importStatement = code.slice(imp.ss, imp.se);
	// Find the closing curly brace in the import statement
	const closingBraceIndex = importStatement.indexOf("}");
	if (closingBraceIndex === -1) {
		// Malformed import, just return as is
		return code;
	}
	// Check if importName is already present
	if (importStatement.includes(importName)) {
		return code;
	}
	// Insert 'importName' before the closing brace, handling whitespace
	const before = importStatement.slice(0, closingBraceIndex).replace(/\s+$/, "");
	const after = importStatement.slice(closingBraceIndex);
	const newImportStatement = before + (before.endsWith("{") ? `${importName} ` : `, ${importName} `) + after;
	// Replace the old import statement with the new one
	return code.slice(0, imp.ss) + newImportStatement + code.slice(imp.se);
}

export const addPictureToFrontmatter = async (value: string) => {
	// The await is important for WASM loading reasons
	const { parse } = await import("es-module-lexer");
	const [imports] = await parse(value);
	const importsAssets = imports.find((imp) => imp.n === "astro:assets");
	if (!importsAssets) {
		// Always add newline before and after the import
		const trimmedValue = value.trimStart();
		return `\nimport { Picture } from "astro:assets";\n${trimmedValue}`;
	}
	return insertIntoImport(value, importsAssets, "Picture");
};

export const addImageToFrontmatter = async (value: string) => {
	// The await is important for WASM loading reasons
	const { parse } = await import("es-module-lexer");
	const [imports] = await parse(value);
	const importsAssets = imports.find((imp) => imp.n === "astro:assets");
	if (!importsAssets) {
		const trimmedValue = value.trimStart();
		return `\nimport { Image } from "astro:assets";\n${trimmedValue}`;
	}
	return insertIntoImport(value, importsAssets, "Image");
};

export const addPlaceholderImageToFrontmatter = async (value: string) => {
	// The await is important for WASM loading reasons
	const { parse } = await import("es-module-lexer");
	const [imports] = await parse(value);

	// Check if placeholderImage is already imported
	const hasPlaceholderImage = imports.some((imp) => {
		const importPath = value.slice(imp.s, imp.e);
		return importPath.includes("placeholder-image.png");
	});

	if (hasPlaceholderImage) {
		return value;
	}

	// Always add newline before, trim any leading whitespace from value
	const trimmedValue = value.trimStart();
	return `\nimport placeholderImage from "../assets/images/placeholder-image.png";\n${trimmedValue}`;
};

export const addImageImportToFrontmatter = async (value: string, variableName: string, imagePath: string): Promise<string> => {
	// The await is important for WASM loading reasons
	const { parse } = await import("es-module-lexer");
	const [imports] = await parse(value);

	// Check if this exact import already exists
	const hasImport = imports.some((imp) => {
		const importPath = value.slice(imp.s, imp.e);
		return importPath === imagePath;
	});

	if (hasImport) {
		return value;
	}

	// Always add newline before, trim any leading whitespace from value
	const trimmedValue = value.trimStart();
	return `\nimport ${variableName} from "${imagePath}";\n${trimmedValue}`;
};

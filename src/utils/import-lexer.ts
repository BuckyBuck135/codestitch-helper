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

	const importStatement = 'import placeholderImage from "../assets/images/placeholder-image.png";';

	// If there are existing imports, insert after the last one
	if (imports.length > 0) {
		const lastImport = imports[imports.length - 1];
		let insertPosition = lastImport.se;

		// Find the end of the line (after any semicolons, comments, etc.)
		const afterImport = value.slice(insertPosition);
		const newlineMatch = afterImport.match(/\n/);
		if (newlineMatch) {
			insertPosition += newlineMatch.index! + 1; // Position after the newline
		}

		return value.slice(0, insertPosition) + importStatement + '\n' + value.slice(insertPosition);
	}

	// No existing imports, add at the beginning
	const trimmedValue = value.trimStart();
	return `\n${importStatement}\n${trimmedValue}`;
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

	const importStatement = `import ${variableName} from "${imagePath}";`;

	// If there are existing imports, insert after the last one
	if (imports.length > 0) {
		const lastImport = imports[imports.length - 1];
		let insertPosition = lastImport.se;

		// Find the end of the line (after any semicolons, comments, etc.)
		const afterImport = value.slice(insertPosition);
		const newlineMatch = afterImport.match(/\n/);
		if (newlineMatch) {
			insertPosition += newlineMatch.index! + 1; // Position after the newline
		}

		return value.slice(0, insertPosition) + importStatement + '\n' + value.slice(insertPosition);
	}

	// No existing imports, add at the beginning
	const trimmedValue = value.trimStart();
	return `\n${importStatement}\n${trimmedValue}`;
};

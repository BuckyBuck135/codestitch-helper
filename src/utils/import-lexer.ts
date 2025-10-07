/**
 * WASM Loading Note: Dynamic imports with `await import("es-module-lexer")`
 * are required because es-module-lexer uses WASM and needs async initialization.
 */

function insertIntoImport(code: string, imp: { ss: number; se: number }, importName: string): string {
	const importStatement = code.slice(imp.ss, imp.se);
	const closingBraceIndex = importStatement.indexOf("}");

	if (closingBraceIndex === -1 || importStatement.includes(importName)) {
		return code;
	}

	const before = importStatement.slice(0, closingBraceIndex).replace(/\s+$/, "");
	const after = importStatement.slice(closingBraceIndex);
	const newImportStatement = before + (before.endsWith("{") ? `${importName} ` : `, ${importName} `) + after;

	return code.slice(0, imp.ss) + newImportStatement + code.slice(imp.se);
}

function insertImportAfterLast(value: string, imports: readonly any[], importStatement: string): string {
	if (imports.length > 0) {
		const lastImport = imports[imports.length - 1];
		let insertPosition = lastImport.se;

		// Find end of line to preserve inline comments/semicolons
		const afterImport = value.slice(insertPosition);
		const newlineMatch = afterImport.match(/\n/);
		if (newlineMatch) {
			insertPosition += newlineMatch.index! + 1;
		}

		return value.slice(0, insertPosition) + importStatement + '\n' + value.slice(insertPosition);
	}

	// No existing imports, add at beginning
	const trimmedValue = value.trimStart();
	return `\n${importStatement}\n${trimmedValue}`;
}

export const addPictureToFrontmatter = async (value: string) => {
	const { parse } = await import("es-module-lexer");
	const [imports] = await parse(value);
	const importsAssets = imports.find((imp) => imp.n === "astro:assets");

	if (!importsAssets) {
		const trimmedValue = value.trimStart();
		return `\nimport { Picture } from "astro:assets";\n${trimmedValue}`;
	}

	return insertIntoImport(value, importsAssets, "Picture");
};

export const addImageToFrontmatter = async (value: string) => {
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
	const { parse } = await import("es-module-lexer");
	const [imports] = await parse(value);

	const hasPlaceholderImage = imports.some((imp) => {
		const importPath = value.slice(imp.s, imp.e);
		return importPath.includes("placeholder-image.png");
	});

	if (hasPlaceholderImage) {
		return value;
	}

	const importStatement = 'import placeholderImage from "../assets/images/placeholder-image.png";';
	return insertImportAfterLast(value, imports, importStatement);
};

export const addImageImportToFrontmatter = async (value: string, variableName: string, imagePath: string): Promise<string> => {
	const { parse } = await import("es-module-lexer");
	const [imports] = await parse(value);

	const hasImport = imports.some((imp) => {
		const importPath = value.slice(imp.s, imp.e);
		return importPath === imagePath;
	});

	if (hasImport) {
		return value;
	}

	const importStatement = `import ${variableName} from "${imagePath}";`;
	return insertImportAfterLast(value, imports, importStatement);
};

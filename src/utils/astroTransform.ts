import * as path from "path";

// Type definitions
type ElementNode = any;
type ComponentNode = any;
type AttributeNode = any;

// Attribute processing constants
const EXCLUDED_PICTURE_ATTRS = ["src", "class", "decoding", "loading", "height", "alt"];
const EXCLUDED_IMAGE_ATTRS = ["src", "class", "decoding", "loading", "height"];
const NUMERIC_ATTRS = ["width"];

export const urlToVariableName = (url: string): string => {
	const filename = path.basename(url);
	const title = filename.split(".")[0];
	if (!title) {return "image";}

	let cleanTitle = title.replace(/[^a-zA-Z0-9-_]/g, "");
	cleanTitle = cleanTitle.replace(/[-_]([a-zA-Z0-9])/g, (match: any, char: any) => char.toUpperCase());

	if (/^[0-9]/.test(cleanTitle)) {
		cleanTitle = "img" + cleanTitle;
	}

	return cleanTitle || "image";
};

export const calculateRelativePath = (fromFilePath: string, toFilePath: string): string => {
	const fromDir = path.dirname(fromFilePath);
	let relativePath = path.relative(fromDir, toFilePath);
	relativePath = relativePath.replace(/\\/g, "/");

	if (!relativePath.startsWith(".")) {
		relativePath = "./" + relativePath;
	}

	return relativePath;
};

export const calculateNewPicture = (node: ElementNode, srcVariableName: string = "placeholderImage", altText: string = ""): ComponentNode => {
	const { attributes: pictureAttributes, children } = node;

	const imgChild = children.find((child: any) => child.type === "element" && (child as ElementNode).name === "img") as ElementNode | undefined;

	if (!imgChild) {
		return { type: "component", name: "Picture", attributes: [], children: [] };
	}

	const newAttributes: AttributeNode[] = [];

	newAttributes.push({
		type: "attribute",
		kind: "expression",
		name: "src",
		value: srcVariableName,
	});

	newAttributes.push({
		type: "attribute",
		kind: "quoted",
		name: "alt",
		value: altText || "",
		raw: `"${altText || ""}"`,
	});

	const pictureClassAttr = pictureAttributes.find((attr: any) => attr.name === "class");
	const imgClassAttr = imgChild.attributes.find((attr: any) => attr.name === "class");

	if (imgClassAttr) {
		newAttributes.push({
			type: "attribute",
			kind: "expression",
			name: "class",
			value: `"${imgClassAttr.value}"`,
		});
	}

	if (pictureClassAttr) {
		newAttributes.push({
			type: "attribute",
			kind: "expression",
			name: "pictureAttributes",
			value: `{ class: "${pictureClassAttr.value}" }`,
		});
	}

	for (const attr of imgChild.attributes as any[]) {
		if (!EXCLUDED_PICTURE_ATTRS.includes(attr.name)) {
			const numericValue = parseInt(attr.value, 10);
			if (NUMERIC_ATTRS.includes(attr.name) && !isNaN(numericValue) && numericValue.toString() === attr.value) {
				newAttributes.push({
					type: "attribute",
					kind: "expression",
					name: attr.name,
					value: attr.value,
				});
			} else {
				newAttributes.push(attr);
			}
		}
	}

	return {
		type: "component",
		name: "Picture",
		attributes: newAttributes,
		children: [],
	};
};

export const calculateNewImage = (node: ElementNode, srcVariableName: string = "placeholderImage"): ComponentNode => {
	const { attributes } = node;
	const newAttributes: AttributeNode[] = [];

	newAttributes.push({
		type: "attribute",
		kind: "expression",
		name: "src",
		value: srcVariableName,
	});

	const classAttr = attributes.find((attr: any) => attr.name === "class");
	if (classAttr) {
		newAttributes.push({
			type: "attribute",
			kind: "expression",
			name: "class",
			value: `"${classAttr.value}"`,
		});
	}

	for (const attr of attributes as any[]) {
		if (!EXCLUDED_IMAGE_ATTRS.includes(attr.name)) {
			const numericValue = parseInt(attr.value, 10);
			if (NUMERIC_ATTRS.includes(attr.name) && !isNaN(numericValue) && numericValue.toString() === attr.value) {
				newAttributes.push({
					type: "attribute",
					kind: "expression",
					name: attr.name,
					value: attr.value,
				});
			} else {
				newAttributes.push(attr);
			}
		}
	}

	return {
		type: "component",
		name: "Image",
		attributes: newAttributes,
		children: [],
	};
};

// Type definitions
type ElementNode = any;
type ComponentNode = any;
type AttributeNode = any;

const isPicture = (node: ElementNode) => node.name === "picture";

const isImage = (node: ElementNode) => node.name === "img";

export const urlToVariableName = (url: string): string => {
  const path = require("path");

  // Get just the filename (handles both Windows and Unix paths)
  const filename = path.basename(url);

  // Remove extension
  const title = filename.split(".")[0];
  if (!title) return "image";

  // Remove all non-alphanumeric characters (including spaces) except hyphens and underscores
  let cleanTitle = title.replace(/[^a-zA-Z0-9-_]/g, "");

  // Convert kebab-case and snake_case to camelCase
  cleanTitle = cleanTitle.replace(/[-_]([a-zA-Z0-9])/g, (match: any, char: any) =>
    char.toUpperCase()
  );

  // Ensure it starts with a letter or underscore (valid JS identifier)
  if (/^[0-9]/.test(cleanTitle)) {
    cleanTitle = "img" + cleanTitle;
  }

  return cleanTitle || "image";
};

export const calculateRelativePath = (fromFilePath: string, toFilePath: string): string => {
  const path = require("path");

  // Get directory of the current file
  const fromDir = path.dirname(fromFilePath);

  // Calculate relative path
  let relativePath = path.relative(fromDir, toFilePath);

  // Convert Windows backslashes to forward slashes
  relativePath = relativePath.replace(/\\/g, "/");

  // Ensure it starts with ./ or ../
  if (!relativePath.startsWith(".")) {
    relativePath = "./" + relativePath;
  }

  return relativePath;
};

export const calculateNewPicture = (node: ElementNode, srcVariableName: string = "placeholderImage", altText: string = ""): ComponentNode => {
  const { attributes: pictureAttributes, children } = node;

  // Find the img child element
  const imgChild = children.find(
    (child: any) => child.type === "element" && (child as ElementNode).name === "img"
  ) as ElementNode | undefined;

  if (!imgChild) {
    return { type: "component", name: "Picture", attributes: [], children: [] };
  }

  const newAttributes: AttributeNode[] = [];

  // Add src with provided variable name
  newAttributes.push({
    type: "attribute",
    kind: "expression",
    name: "src",
    value: srcVariableName,
  });

  // Add alt text (always use provided altText, never reuse original)
  // Ensure altText is a string (convert undefined to empty string just in case)
  const finalAltText = altText || "";
  newAttributes.push({
    type: "attribute",
    kind: "quoted",
    name: "alt",
    value: finalAltText,
    raw: `"${finalAltText}"`, // Raw includes the quotes for serializer
  });

  // Handle class attributes specially
  const pictureClassAttr = pictureAttributes.find(
    (attr: any) => attr.name === "class"
  );
  const imgClassAttr = imgChild.attributes.find(
    (attr: any) => attr.name === "class"
  );

  if (imgClassAttr) {
    // Convert img class to expression
    newAttributes.push({
      type: "attribute",
      kind: "expression",
      name: "class",
      value: `"${imgClassAttr.value}"`,
    });
  }

  if (pictureClassAttr) {
    // Add pictureAttributes with picture class
    newAttributes.push({
      type: "attribute",
      kind: "expression",
      name: "pictureAttributes",
      value: `{ class: "${pictureClassAttr.value}" }`,
    });
  }

  // Add other attributes from img, converting specific numeric ones to expressions
  // Exclude src, class, decoding, loading, height, and alt (alt is handled separately)
  const excludedAttrs = ["src", "class", "decoding", "loading", "height", "alt"];
  const numericAttrs = ["width"];

  for (const attr of imgChild.attributes as any[]) {
    if (!excludedAttrs.includes(attr.name)) {
      // Only convert to numeric expressions for specific attributes like width
      const numericValue = parseInt(attr.value, 10);
      if (
        numericAttrs.includes(attr.name) &&
        !isNaN(numericValue) &&
        numericValue.toString() === attr.value
      ) {
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

  // Add src with provided variable name
  newAttributes.push({
    type: "attribute",
    kind: "expression",
    name: "src",
    value: srcVariableName,
  });

  // Handle class attributes specially - convert to expression
  const classAttr = attributes.find((attr: any) => attr.name === "class");
  if (classAttr) {
    newAttributes.push({
      type: "attribute",
      kind: "expression",
      name: "class",
      value: `"${classAttr.value}"`,
    });
  }

  // Add other attributes, converting specific numeric ones to expressions
  // Exclude src, class, decoding, loading, and height
  const excludedAttrs = ["src", "class", "decoding", "loading", "height"];
  const numericAttrs = ["width"];

  for (const attr of attributes as any[]) {
    if (!excludedAttrs.includes(attr.name)) {
      // Only convert to numeric expressions for specific attributes like width
      const numericValue = parseInt(attr.value, 10);
      if (
        numericAttrs.includes(attr.name) &&
        !isNaN(numericValue) &&
        numericValue.toString() === attr.value
      ) {
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

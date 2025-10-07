// Type definitions
type ElementNode = any;
type ComponentNode = any;
type AttributeNode = any;

const isPicture = (node: ElementNode) => node.name === "picture";

const isImage = (node: ElementNode) => node.name === "img";

export const calculateNewPicture = (node: ElementNode): ComponentNode => {
  const { attributes: pictureAttributes, children } = node;

  // Find the img child element
  const imgChild = children.find(
    (child: any) => child.type === "element" && (child as ElementNode).name === "img"
  ) as ElementNode | undefined;

  if (!imgChild) {
    return { type: "component", name: "Picture", attributes: [], children: [] };
  }

  const newAttributes: AttributeNode[] = [];

  // Add src as placeholderImage expression
  newAttributes.push({
    type: "attribute",
    kind: "expression",
    name: "src",
    value: "placeholderImage",
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
  // Exclude src, class, decoding, loading, and height
  const excludedAttrs = ["src", "class", "decoding", "loading", "height"];
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

export const calculateNewImage = (node: ElementNode): ComponentNode => {
  const { attributes } = node;

  const newAttributes: AttributeNode[] = [];

  // Add src as placeholderImage expression
  newAttributes.push({
    type: "attribute",
    kind: "expression",
    name: "src",
    value: "placeholderImage",
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

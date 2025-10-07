import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export type ProjectType = "eleventy" | "astro" | "unknown";

const WORKSPACE_STATE_KEY = "codestitchHelper.projectType";

export class ProjectTypeManager {
  private context: vscode.ExtensionContext;
  private projectType: ProjectType = "unknown";

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Detects the project type by checking for framework-specific files and package.json dependencies
   */
  async detect(): Promise<ProjectType> {
    // First check if user has manually set a preference
    const savedType = this.context.workspaceState.get<ProjectType>(
      WORKSPACE_STATE_KEY
    );
    if (savedType && savedType !== "unknown") {
      this.projectType = savedType;
      return savedType;
    }

    // Auto-detect based on project files
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      this.projectType = "unknown";
      return "unknown";
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;

    // Check for Astro
    const astroConfigFiles = [
      "astro.config.js",
      "astro.config.mjs",
      "astro.config.ts",
      "astro.config.cjs",
    ];

    for (const configFile of astroConfigFiles) {
      if (fs.existsSync(path.join(workspacePath, configFile))) {
        this.projectType = "astro";
        await this.saveProjectType("astro");
        return "astro";
      }
    }

    // Check for Eleventy
    const eleventyConfigFiles = [
      ".eleventy.js",
      "eleventy.config.js",
      "eleventy.config.cjs",
    ];

    for (const configFile of eleventyConfigFiles) {
      if (fs.existsSync(path.join(workspacePath, configFile))) {
        this.projectType = "eleventy";
        await this.saveProjectType("eleventy");
        return "eleventy";
      }
    }

    // Check package.json for dependencies
    const packageJsonPath = path.join(workspacePath, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
        const packageJson = JSON.parse(packageJsonContent);

        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        if (allDeps["astro"]) {
          this.projectType = "astro";
          await this.saveProjectType("astro");
          return "astro";
        }

        if (
          allDeps["@11ty/eleventy"] ||
          allDeps["eleventy"] ||
          allDeps["@codestitchofficial/eleventy-plugin-sharp-images"]
        ) {
          this.projectType = "eleventy";
          await this.saveProjectType("eleventy");
          return "eleventy";
        }
      } catch (error) {
        console.error("Error reading package.json:", error);
      }
    }

    this.projectType = "unknown";
    return "unknown";
  }

  /**
   * Get the current project type
   */
  getProjectType(): ProjectType {
    return this.projectType;
  }

  /**
   * Manually set the project type and save to workspace state
   */
  async setProjectType(type: ProjectType): Promise<void> {
    this.projectType = type;
    await this.saveProjectType(type);
  }

  /**
   * Check if the current project is Eleventy
   */
  isEleventy(): boolean {
    return this.projectType === "eleventy";
  }

  /**
   * Check if the current project is Astro
   */
  isAstro(): boolean {
    return this.projectType === "astro";
  }

  /**
   * Check if the project type is unknown
   */
  isUnknown(): boolean {
    return this.projectType === "unknown";
  }

  /**
   * Save the project type to workspace state
   */
  private async saveProjectType(type: ProjectType): Promise<void> {
    await this.context.workspaceState.update(WORKSPACE_STATE_KEY, type);
  }

  /**
   * Clear the saved project type preference
   */
  async clearProjectType(): Promise<void> {
    await this.context.workspaceState.update(WORKSPACE_STATE_KEY, undefined);
    this.projectType = "unknown";
  }

  /**
   * Validate if a project type matches what's actually in the workspace
   * Returns the detected type and whether it matches the requested type
   */
  async validateProjectType(
    requestedType: ProjectType
  ): Promise<{ detected: ProjectType; matches: boolean }> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return { detected: "unknown", matches: false };
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;

    // Check for Astro indicators
    const astroConfigFiles = [
      "astro.config.js",
      "astro.config.mjs",
      "astro.config.ts",
      "astro.config.cjs",
    ];

    let hasAstroConfig = false;
    for (const configFile of astroConfigFiles) {
      if (fs.existsSync(path.join(workspacePath, configFile))) {
        hasAstroConfig = true;
        break;
      }
    }

    // Check for Eleventy indicators
    const eleventyConfigFiles = [
      ".eleventy.js",
      "eleventy.config.js",
      "eleventy.config.cjs",
    ];

    let hasEleventyConfig = false;
    for (const configFile of eleventyConfigFiles) {
      if (fs.existsSync(path.join(workspacePath, configFile))) {
        hasEleventyConfig = true;
        break;
      }
    }

    // Check package.json
    let hasAstroDep = false;
    let hasEleventyDep = false;

    const packageJsonPath = path.join(workspacePath, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
        const packageJson = JSON.parse(packageJsonContent);

        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        hasAstroDep = !!allDeps["astro"];
        hasEleventyDep = !!(
          allDeps["@11ty/eleventy"] ||
          allDeps["eleventy"] ||
          allDeps["@codestitchofficial/eleventy-plugin-sharp-images"]
        );
      } catch (error) {
        console.error("Error reading package.json:", error);
      }
    }

    // Determine detected type
    let detectedType: ProjectType = "unknown";
    if (hasAstroConfig || hasAstroDep) {
      detectedType = "astro";
    } else if (hasEleventyConfig || hasEleventyDep) {
      detectedType = "eleventy";
    }

    return {
      detected: detectedType,
      matches: detectedType === requestedType || detectedType === "unknown",
    };
  }
}

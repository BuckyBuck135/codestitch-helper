import * as vscode from "vscode";
import { SectionNavigationProvider } from "./providers/sectionNavigationProvider";
import { replaceNavTabs } from "./commands/eleventy/replaceNavTabs";
import { selectAll } from "./commands/shared/selectAll";
import { openSection } from "./commands/shared/openSection";
import { CodeLensProvider } from "./providers/codeLensProvider";
import { addIconClass } from "./commands/shared/addIconClass";
import { convertToNetlifyForm } from "./commands/shared/convertToNetlifyForm";
import { optimizeSharpImages } from "./commands/eleventy/optimizeSharpImages";
import { optimizeAstroImages } from "./commands/astro/optimizeAstroImages";
import {
  navigateToSectionCSS,
  navigateToSectionCSSCommandId,
} from "./commands/shared/navigateToSectionCSS";
import { setupEleventySharpImages } from "./commands/eleventy/setupEleventySharpImages";
import { optimizeStylesheet } from "./commands/shared/optimizeStylesheet";
import { navigateToCodeStitch } from "./commands/shared/navigateToCodeStitch";
import { reorderSections } from "./commands/shared/reorderSections";
import { CodeSection } from "./utils/sectionUtils";
import { downloadSvgAssets } from "./commands/shared/downloadSvgAssets";
import * as path from "path";
import * as fs from "fs";
import { SidebarProvider } from "./providers/sidebarProvider";
import { ProjectTypeManager } from "./services/projectTypeManager";

export async function activate(context: vscode.ExtensionContext) {
  console.log("codestitch-helper is now active!");

  // Initialize ProjectTypeManager and detect project type
  const projectTypeManager = new ProjectTypeManager(context);
  const projectType = await projectTypeManager.detect();

  if (projectType === "unknown") {
    vscode.window.showWarningMessage(
      "CodeStitch Helper: Could not auto-detect project type (Eleventy/Astro). Please set it manually in the sidebar.",
      "Open Sidebar"
    ).then((selection) => {
      if (selection === "Open Sidebar") {
        vscode.commands.executeCommand("workbench.view.extension.codestitchHelperContainer");
      }
    });
  } else {
    vscode.window.showInformationMessage(
      `CodeStitch Helper: Detected ${projectType === "eleventy" ? "Eleventy" : "Astro"} project`
    );
  }

  const sectionNavProvider = new SectionNavigationProvider();
  vscode.window.registerTreeDataProvider(
    "sectionNavigator",
    sectionNavProvider
  );

  // Register shared commands (always available)
  const openSectionDisposable = vscode.commands.registerCommand(
    "codestitchHelper.openSection",
    (section: CodeSection) => {
      openSection(section);
    }
  );

  const selectAllDisposable = vscode.commands.registerCommand(
    "codestitchHelper.selectAll",
    (section: CodeSection) => {
      selectAll(section);
    }
  );

  const addIconClassDisposable = vscode.commands.registerCommand(
    "codestitchHelper.addIconClass",
    (document: vscode.TextDocument, range: vscode.Range) => {
      addIconClass(document, range);
    }
  );

  const convertToNetlifyFormDisposable = vscode.commands.registerCommand(
    "codestitchHelper.convertToNetlifyForm",
    (document: vscode.TextDocument) => {
      convertToNetlifyForm(document);
    }
  );

  const navigateToSectionCSSDisposable = vscode.commands.registerCommand(
    navigateToSectionCSSCommandId,
    navigateToSectionCSS
  );

  const optimizeStylesheetDisposable = vscode.commands.registerCommand(
    "codestitchHelper.optimizeStylesheet",
    (document: vscode.TextDocument, linkTag: string) => {
      optimizeStylesheet(document, linkTag);
    }
  );

  const navigateToCodeStitchDisposable = vscode.commands.registerCommand(
    "codestitchHelper.navigateToCodeStitch",
    (sectionId: string) => {
      navigateToCodeStitch(sectionId);
    }
  );

  const reorderSectionsDisposable = vscode.commands.registerCommand(
    "codestitchHelper.reorderSections",
    () => {
      reorderSections();
    }
  );

  const downloadSvgAssetsDisposable = vscode.commands.registerCommand(
    "codestitchHelper.downloadSvgAssets",
    downloadSvgAssets
  );

  // Register project type management command
  const setProjectTypeDisposable = vscode.commands.registerCommand(
    "codestitchHelper.setProjectType",
    async () => {
      const selection = await vscode.window.showQuickPick(
        ["Eleventy", "Astro"],
        {
          placeHolder: "Select your project type",
        }
      );

      if (selection) {
        const newType = selection.toLowerCase() as "eleventy" | "astro";
        await projectTypeManager.setProjectType(newType);
        vscode.window.showInformationMessage(
          `Project type set to ${selection}. Reloading extension...`
        );
        await vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
    }
  );

  // Register framework-specific commands based on project type
  if (projectTypeManager.isEleventy()) {
    const replaceNavTabsDisposable = vscode.commands.registerCommand(
      "codestitchHelper.eleventy.replaceNavTabs",
      (document: vscode.TextDocument) => {
        replaceNavTabs(document);
      }
    );

    const optimizeSharpImagesDisposable = vscode.commands.registerCommand(
      "codestitchHelper.eleventy.optimizeImages",
      (document: vscode.TextDocument, range: vscode.Range) => {
        optimizeSharpImages(document, range);
      }
    );

    const setupEleventySharpImagesDisposable = vscode.commands.registerCommand(
      "codestitchHelper.eleventy.setupSharpImages",
      () => {
        setupEleventySharpImages();
      }
    );

    context.subscriptions.push(
      replaceNavTabsDisposable,
      optimizeSharpImagesDisposable,
      setupEleventySharpImagesDisposable
    );
  } else if (projectTypeManager.isAstro()) {
    const optimizeAstroImagesDisposable = vscode.commands.registerCommand(
      "codestitchHelper.astro.optimizeImages",
      (document: vscode.TextDocument, range: vscode.Range) => {
        optimizeAstroImages(document, range);
      }
    );

    context.subscriptions.push(optimizeAstroImagesDisposable);
  }

  // Ensure the Explorer view is open
  vscode.commands.executeCommand("workbench.view.explorer");

  // Register CodeLensProvider with ProjectTypeManager
  const codeLensProvider = new CodeLensProvider(projectTypeManager);
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: "*" },
      codeLensProvider
    )
  );

  const supportedLanguages = [
    "scss",
    "css",
    "sass",
    "less",
    "njk",
    "nunjucks",
    "html",
    "astro",
  ];
  vscode.workspace.onDidChangeTextDocument((event) => {
    if (supportedLanguages.includes(event.document.languageId)) {
      sectionNavProvider.refresh();
    }
  });

  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor && supportedLanguages.includes(editor.document.languageId)) {
      sectionNavProvider.refresh();
    }
  });

  vscode.workspace.onDidOpenTextDocument((document) => {
    if (supportedLanguages.includes(document.languageId)) {
      sectionNavProvider.refresh();
    }
  });

  context.subscriptions.push(
    openSectionDisposable,
    selectAllDisposable,
    addIconClassDisposable,
    convertToNetlifyFormDisposable,
    navigateToSectionCSSDisposable,
    optimizeStylesheetDisposable,
    navigateToCodeStitchDisposable,
    reorderSectionsDisposable,
    downloadSvgAssetsDisposable,
    setProjectTypeDisposable
  );

  // Register Sidebar Provider with ProjectTypeManager
  const provider = new SidebarProvider(context.extensionUri, projectTypeManager);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewType,
      provider
    )
  );
}

export function deactivate() {}

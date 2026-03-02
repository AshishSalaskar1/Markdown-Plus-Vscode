/**
 * Markdown Plus — Webview entry point
 *
 * Initialises Milkdown Crepe and wires up the bidirectional
 * message bridge between the WYSIWYG editor and the extension host.
 */

import { Crepe } from "@milkdown/crepe";
import { replaceAll, callCommand } from "@milkdown/utils";
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  wrapInHeadingCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  insertHrCommand,
  createCodeBlockCommand,
  toggleLinkCommand,
  insertImageCommand,
} from "@milkdown/preset-commonmark";
import {
  toggleStrikethroughCommand,
  insertTableCommand,
} from "@milkdown/preset-gfm";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import "./styles/editor.css";
import "./styles/themes.css";

/**
 * Apply a theme by setting the `data-theme` attribute on both the
 * `.milkdown` container and the `<body>`. When the theme is "vscode",
 * remove the attribute so the default VS Code CSS variable mappings
 * from editor.css take effect.
 */
function applyTheme(themeId: string): void {
  const milkdown = document.querySelector(".milkdown") as HTMLElement | null;
  if (themeId === "vscode") {
    milkdown?.removeAttribute("data-theme");
    document.body.removeAttribute("data-theme");
  } else {
    milkdown?.setAttribute("data-theme", themeId);
    document.body.setAttribute("data-theme", themeId);
  }
}

/**
 * Apply a custom font size by setting a CSS custom property on the body.
 * The editor.css stylesheet reads `--mdplus-font-size` to size all content.
 */
function applyFontSize(fontSize: number): void {
  document.documentElement.style.setProperty(
    "--mdplus-font-size",
    `${fontSize}px`,
  );
}

// -------------------------------------------------------------------
// Toolbar builder — creates a modern editing bar above the editor
// -------------------------------------------------------------------

/** SVG icon paths (24×24 viewBox, stroked). */
const ICONS: Record<string, string> = {
  bold: '<path d="M6 4h8a4 4 0 0 1 0 8H6z"/><path d="M6 12h9a4 4 0 0 1 0 8H6z"/>',
  italic: '<line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>',
  strikethrough: '<line x1="4" y1="12" x2="20" y2="12"/><path d="M17.5 7.5c0-2-1.5-3.5-4-3.5H8c-2.5 0-4 1.5-4 3.5s1.5 3 3.5 3"/><path d="M6.5 16.5c0 2 1.5 3.5 4 3.5h3c2.5 0 4-1.5 4-3.5s-1.5-3-3.5-3"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  codeBlock: '<rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="10 8 14 12 10 16"/>',
  heading: '<path d="M6 4v16"/><path d="M18 4v16"/><path d="M6 12h12"/>',
  chevron: '<polyline points="6 9 12 15 18 9"/>',
  quote: '<path d="M3 6h18"/><path d="M3 10h18"/><path d="M3 14h14"/><line x1="3" y1="4" x2="3" y2="16" stroke-width="3"/>',
  bulletList: '<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/>',
  orderedList: '<line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="4" y="7" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif" text-anchor="middle">1</text><text x="4" y="13" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif" text-anchor="middle">2</text><text x="4" y="19" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif" text-anchor="middle">3</text>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  table: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>',
  hr: '<line x1="2" y1="12" x2="22" y2="12"/>',
};

function svgIcon(name: string, cls = ""): string {
  const extra = cls ? ` class="${cls}"` : "";
  return `<svg${extra} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${ICONS[name]}</svg>`;
}

interface ToolbarItem {
  kind: "button" | "separator" | "heading-dropdown";
  icon?: string;
  tooltip?: string;
  action?: (crepe: Crepe) => void;
}

const toolbarItems: ToolbarItem[] = [
  {
    kind: "heading-dropdown",
  },
  { kind: "separator" },
  {
    kind: "button",
    icon: "bold",
    tooltip: "Bold (Ctrl+B)",
    action: (c) => c.editor.action(callCommand(toggleStrongCommand.key)),
  },
  {
    kind: "button",
    icon: "italic",
    tooltip: "Italic (Ctrl+I)",
    action: (c) => c.editor.action(callCommand(toggleEmphasisCommand.key)),
  },
  {
    kind: "button",
    icon: "strikethrough",
    tooltip: "Strikethrough",
    action: (c) => c.editor.action(callCommand(toggleStrikethroughCommand.key)),
  },
  {
    kind: "button",
    icon: "code",
    tooltip: "Inline Code",
    action: (c) => c.editor.action(callCommand(toggleInlineCodeCommand.key)),
  },
  { kind: "separator" },
  {
    kind: "button",
    icon: "quote",
    tooltip: "Blockquote",
    action: (c) => c.editor.action(callCommand(wrapInBlockquoteCommand.key)),
  },
  {
    kind: "button",
    icon: "bulletList",
    tooltip: "Bullet List",
    action: (c) => c.editor.action(callCommand(wrapInBulletListCommand.key)),
  },
  {
    kind: "button",
    icon: "orderedList",
    tooltip: "Ordered List",
    action: (c) => c.editor.action(callCommand(wrapInOrderedListCommand.key)),
  },
  { kind: "separator" },
  {
    kind: "button",
    icon: "codeBlock",
    tooltip: "Code Block",
    action: (c) => c.editor.action(callCommand(createCodeBlockCommand.key)),
  },
  {
    kind: "button",
    icon: "table",
    tooltip: "Table",
    action: (c) => c.editor.action(callCommand(insertTableCommand.key, { row: 3, col: 3 })),
  },
  {
    kind: "button",
    icon: "link",
    tooltip: "Link",
    action: (c) => c.editor.action(callCommand(toggleLinkCommand.key, { href: "" })),
  },
  {
    kind: "button",
    icon: "image",
    tooltip: "Image",
    action: (c) => c.editor.action(callCommand(insertImageCommand.key, { src: "", alt: "", title: "" })),
  },
  {
    kind: "button",
    icon: "hr",
    tooltip: "Horizontal Rule",
    action: (c) => c.editor.action(callCommand(insertHrCommand.key)),
  },
];

function buildToolbar(crepe: Crepe): void {
  const container = document.getElementById("toolbar");
  if (!container) return;

  for (const item of toolbarItems) {
    if (item.kind === "separator") {
      const sep = document.createElement("div");
      sep.className = "toolbar-separator";
      container.appendChild(sep);
      continue;
    }

    if (item.kind === "heading-dropdown") {
      const wrapper = document.createElement("div");
      wrapper.className = "heading-dropdown";

      const trigger = document.createElement("button");
      trigger.className = "heading-trigger";
      trigger.innerHTML = `${svgIcon("heading")} <span>Heading</span> ${svgIcon("chevron", "chevron")}`;
      trigger.setAttribute("data-tooltip", "Insert heading");
      wrapper.appendChild(trigger);

      const menu = document.createElement("div");
      menu.className = "heading-menu";

      const headingLevels = [
        { label: "Heading 1", level: 1, size: "1.4em" },
        { label: "Heading 2", level: 2, size: "1.2em" },
        { label: "Heading 3", level: 3, size: "1.05em" },
        { label: "Heading 4", level: 4, size: "0.95em" },
        { label: "Heading 5", level: 5, size: "0.88em" },
        { label: "Heading 6", level: 6, size: "0.82em" },
      ];

      for (const h of headingLevels) {
        const btn = document.createElement("button");
        btn.innerHTML = `<span style="font-size:${h.size}">${h.label}</span>`;
        btn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          crepe.editor.action(callCommand(wrapInHeadingCommand.key, h.level));
          menu.classList.remove("open");
        });
        menu.appendChild(btn);
      }

      wrapper.appendChild(menu);

      trigger.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        menu.classList.toggle("open");
      });

      // Close heading menu when clicking outside
      document.addEventListener("mousedown", (e) => {
        if (!wrapper.contains(e.target as Node)) {
          menu.classList.remove("open");
        }
      });

      container.appendChild(wrapper);
      continue;
    }

    // Regular button
    const btn = document.createElement("button");
    btn.innerHTML = svgIcon(item.icon!);
    btn.setAttribute("data-tooltip", item.tooltip!);
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault(); // keep editor focus
      item.action?.(crepe);
    });
    container.appendChild(btn);
  }
}

// Wrap in async IIFE — esbuild IIFE format does not support top-level await.
(async () => {
  // -------------------------------------------------------------------
  // VS Code API & sync state
  // -------------------------------------------------------------------

  const vscode = acquireVsCodeApi();

  let currentVersion = 0;
  let suppressOnChange = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastEditTime = 0;

  const DEBOUNCE_TYPING = 150;
  const DEBOUNCE_IDLE = 50;

  // -------------------------------------------------------------------
  // Milkdown Crepe initialisation
  // -------------------------------------------------------------------

  const crepe = new Crepe({
    root: document.getElementById("editor")!,
    defaultValue: "",
  });

  await crepe.create();

  // -------------------------------------------------------------------
  // Toolbar: build and wire buttons
  // -------------------------------------------------------------------

  buildToolbar(crepe);

  // -------------------------------------------------------------------
  // Outgoing: content change → extension host  (dual-timer debounce)
  // -------------------------------------------------------------------

  crepe.on((listener: any) => {
    listener.markdownUpdated((_ctx: any, markdown: string, prevMarkdown: string) => {
      if (suppressOnChange || markdown === prevMarkdown) return;

      const now = Date.now();
      const timeSinceLastEdit = now - lastEditTime;
      lastEditTime = now;

      if (debounceTimer) clearTimeout(debounceTimer);

      // Shorter debounce when idle, longer during rapid typing.
      const delay = timeSinceLastEdit > 500 ? DEBOUNCE_IDLE : DEBOUNCE_TYPING;

      debounceTimer = setTimeout(() => {
        currentVersion++;
        vscode.postMessage({ type: "edit", markdown, version: currentVersion });
      }, delay);
    });
  });

  // -------------------------------------------------------------------
  // Incoming: extension host → webview  (init / update / themeChange)
  // -------------------------------------------------------------------

  window.addEventListener("message", (event) => {
    const { type, markdown, version, theme, fontSize } = event.data;

    if ((type === "init" || type === "update") && version > currentVersion) {
      currentVersion = version;
      suppressOnChange = true;
      crepe.editor.action(replaceAll(markdown));
      suppressOnChange = false;
    }

    if (type === "themeChange" && theme) {
      applyTheme(theme);
    }

    if (type === "fontSizeChange" && typeof fontSize === "number") {
      applyFontSize(fontSize);
    }
  });

  // -------------------------------------------------------------------
  // Keyboard shortcut coexistence (Step 5.3)
  // -------------------------------------------------------------------
  // Milkdown / ProseMirror captures keyboard events inside the webview
  // iframe, so rich-text shortcuts (Ctrl+B, Ctrl+I, Tab, Enter) work
  // out-of-the-box without conflicting with VS Code shortcuts.
  //
  // Undo / Redo:
  //   - Ctrl+Z / Ctrl+Y are handled by ProseMirror's history plugin
  //     inside the webview.  Each undo fires `markdownUpdated`, which
  //     propagates the change to the extension host as a WorkspaceEdit.
  //   - VS Code's document-level undo operates on WorkspaceEdits,
  //     which is a separate undo stack.  Because the webview iframe
  //     consumes the keypress, VS Code's undo is not triggered, so
  //     there is no conflict for v1.
  //
  // Ctrl+S is forwarded to VS Code by the webview infrastructure and
  // saves the underlying TextDocument as expected.

  // -------------------------------------------------------------------
  // Signal that the webview is ready to receive content
  // -------------------------------------------------------------------

  vscode.postMessage({ type: "ready" });
})();

/**
 * Markdown Pro — Webview entry point
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
import { mermaidRenderPreview, setActiveTheme, initMermaidViewer, reRenderMermaidDiagrams } from './mermaid-plugin';

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
 * The editor.css stylesheet reads `--mdpro-font-size` to size all content.
 */
function applyFontSize(fontSize: number): void {
  document.documentElement.style.setProperty(
    "--mdpro-font-size",
    `${fontSize}px`,
  );
}

/**
 * Apply a custom line height by setting a CSS custom property.
 * Used for line spacing throughout the editor content.
 */
function applyLineHeight(lineHeight: number): void {
  document.documentElement.style.setProperty(
    "--mdpro-line-height",
    `${lineHeight}`,
  );
}

/**
 * Apply a custom font family. An empty string resets to the default
 * (inherited from VS Code theme variables in editor.css).
 */
function applyFontFamily(fontFamily: string): void {
  if (fontFamily) {
    document.documentElement.style.setProperty(
      "--mdpro-font-family",
      fontFamily,
    );
  } else {
    document.documentElement.style.removeProperty("--mdpro-font-family");
  }
}

/**
 * Apply a custom content width (max-width) for the editor and toolbar.
 */
function applyContentWidth(contentWidth: number): void {
  document.documentElement.style.setProperty(
    "--mdpro-content-width",
    `${contentWidth}px`,
  );
}

/**
 * Show or hide the formatting toolbar.
 */
function applyShowToolbar(show: boolean): void {
  const toolbar = document.getElementById("toolbar");
  if (toolbar) {
    toolbar.style.display = show ? "" : "none";
  }
}

// -------------------------------------------------------------------
// Search / Find-in-document  (CSS Custom Highlight API — zero DOM mutation)
// -------------------------------------------------------------------

interface SearchState {
  open: boolean;
  query: string;
  caseSensitive: boolean;
  /** Range objects for every match (used by CSS Highlight API). */
  ranges: Range[];
  currentIndex: number;
}

const searchState: SearchState = {
  open: false,
  query: "",
  caseSensitive: false,
  ranges: [],
  currentIndex: -1,
};

/**
 * Find all text ranges matching `query` inside the ProseMirror editor.
 * Returns an array of Range objects — the DOM is **not** modified.
 */
function findMatchRanges(query: string, caseSensitive: boolean): Range[] {
  const editorEl = document.querySelector(".milkdown .ProseMirror") as HTMLElement | null;
  if (!editorEl || !query) return [];

  const flags = caseSensitive ? "g" : "gi";
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, flags);

  const ranges: Range[] = [];
  const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const text = node.textContent ?? "";
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const range = new Range();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      ranges.push(range);
      if (match[0].length === 0) regex.lastIndex++;
    }
  }

  return ranges;
}

/** Clear all CSS custom highlights for search. */
function clearHighlights(): void {
  CSS.highlights.delete("mdpro-search");
  CSS.highlights.delete("mdpro-search-active");
  searchState.ranges = [];
  searchState.currentIndex = -1;
}

/** Run the search and register highlights via the CSS Custom Highlight API. */
function applyHighlights(query: string, caseSensitive: boolean): void {
  clearHighlights();
  if (!query) {
    updateSearchCount();
    return;
  }

  const ranges = findMatchRanges(query, caseSensitive);
  searchState.ranges = ranges;
  searchState.currentIndex = ranges.length > 0 ? 0 : -1;

  if (ranges.length > 0) {
    const allHighlight = new Highlight(...ranges);
    allHighlight.priority = 1;
    CSS.highlights.set("mdpro-search", allHighlight);
  }

  highlightCurrent();
  updateSearchCount();
}

/** Mark the current match as active (different colour) and scroll to it. */
function highlightCurrent(): void {
  CSS.highlights.delete("mdpro-search-active");

  if (searchState.currentIndex >= 0 && searchState.currentIndex < searchState.ranges.length) {
    const activeRange = searchState.ranges[searchState.currentIndex];
    const activeHighlight = new Highlight(activeRange);
    activeHighlight.priority = 2;
    CSS.highlights.set("mdpro-search-active", activeHighlight);

    // Scroll the match into view
    const rect = activeRange.getBoundingClientRect();
    const scrollContainer = document.scrollingElement ?? document.documentElement;
    const viewTop = scrollContainer.scrollTop;
    const viewBottom = viewTop + window.innerHeight;
    const absTop = rect.top + viewTop;
    if (absTop < viewTop + 80 || absTop > viewBottom - 80) {
      scrollContainer.scrollTo({ top: absTop - window.innerHeight / 3, behavior: "smooth" });
    }
  }
}

/** Update the \u201cN of M\u201d counter in the search bar. */
function updateSearchCount(): void {
  const countEl = document.getElementById("search-count");
  if (!countEl) return;
  const total = searchState.ranges.length;
  if (!searchState.query || total === 0) {
    countEl.textContent = searchState.query ? "No results" : "";
  } else {
    countEl.textContent = `${searchState.currentIndex + 1} of ${total}`;
  }
}

function goToNextMatch(): void {
  if (searchState.ranges.length === 0) return;
  searchState.currentIndex = (searchState.currentIndex + 1) % searchState.ranges.length;
  highlightCurrent();
  updateSearchCount();
}

function goToPrevMatch(): void {
  if (searchState.ranges.length === 0) return;
  searchState.currentIndex =
    (searchState.currentIndex - 1 + searchState.ranges.length) % searchState.ranges.length;
  highlightCurrent();
  updateSearchCount();
}

function openSearchBar(): void {
  const bar = document.getElementById("search-bar");
  const input = document.getElementById("search-input") as HTMLInputElement | null;
  if (!bar || !input) return;
  bar.classList.remove("hidden");
  searchState.open = true;
  input.focus();
  input.select();
}

function closeSearchBar(): void {
  const bar = document.getElementById("search-bar");
  if (!bar) return;
  bar.classList.add("hidden");
  searchState.open = false;
  searchState.query = "";
  clearHighlights();
  updateSearchCount();
}

function toggleSearchBar(): void {
  if (searchState.open) {
    const input = document.getElementById("search-input") as HTMLInputElement | null;
    if (input) { input.focus(); input.select(); }
  } else {
    openSearchBar();
  }
}

function initSearchBar(): void {
  const input = document.getElementById("search-input") as HTMLInputElement | null;
  const prevBtn = document.getElementById("search-prev");
  const nextBtn = document.getElementById("search-next");
  const closeBtn = document.getElementById("search-close");
  const caseBtn = document.getElementById("search-case");
  if (!input) return;

  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  input.addEventListener("input", () => {
    searchState.query = input.value;
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      applyHighlights(searchState.query, searchState.caseSensitive);
    }, 150);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) { goToPrevMatch(); } else { goToNextMatch(); }
    }
    if (e.key === "Escape") {
      e.preventDefault();
      closeSearchBar();
    }
  });

  prevBtn?.addEventListener("click", (e) => { e.preventDefault(); goToPrevMatch(); });
  nextBtn?.addEventListener("click", (e) => { e.preventDefault(); goToNextMatch(); });
  closeBtn?.addEventListener("click", (e) => { e.preventDefault(); closeSearchBar(); });

  caseBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    searchState.caseSensitive = !searchState.caseSensitive;
    caseBtn.classList.toggle("active", searchState.caseSensitive);
    applyHighlights(searchState.query, searchState.caseSensitive);
  });
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
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
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
  { kind: "separator" },
  {
    kind: "button",
    icon: "search",
    tooltip: "Find (Ctrl+F)",
    action: () => toggleSearchBar(),
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
    featureConfigs: {
      [Crepe.Feature.CodeMirror]: {
        renderPreview: mermaidRenderPreview,
      },
    },
  });

  await crepe.create();

  // -------------------------------------------------------------------
  // Toolbar: build and wire buttons
  // -------------------------------------------------------------------

  buildToolbar(crepe);

  // Initialise the search bar
  initSearchBar();

  // Set initial mermaid theme from the editor's current theme
  const initialTheme = document.body.getAttribute('data-theme') ?? 'vscode';
  setActiveTheme(initialTheme);

  // Start the MutationObserver that enhances mermaid previews with
  // interactive zoom / pan controls.
  initMermaidViewer();

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
    const { type, markdown, version, theme, fontSize, lineHeight, fontFamily, contentWidth, showToolbar } = event.data;

    if ((type === "init" || type === "update") && version > currentVersion) {
      currentVersion = version;

      // On init, apply all bundled settings before loading content so
      // mermaid diagrams render with the correct theme on the first pass.
      if (type === "init") {
        if (theme) {
          applyTheme(theme);
          setActiveTheme(theme);
        }
        if (typeof fontSize === "number") applyFontSize(fontSize);
        if (typeof lineHeight === "number") applyLineHeight(lineHeight);
        if (typeof fontFamily === "string") applyFontFamily(fontFamily);
        if (typeof contentWidth === "number") applyContentWidth(contentWidth);
        if (typeof showToolbar === "boolean") applyShowToolbar(showToolbar);
      }

      suppressOnChange = true;
      crepe.editor.action(replaceAll(markdown));
      suppressOnChange = false;
    }

    if (type === "themeChange" && theme) {
      applyTheme(theme);
      // Update mermaid theme — new renders will use the updated theme.
      setActiveTheme(theme);
      // Re-render only mermaid diagrams in place instead of replacing
      // the entire document (avoids expensive full ProseMirror rebuild).
      reRenderMermaidDiagrams();
    }

    if (type === "fontSizeChange" && typeof fontSize === "number") {
      applyFontSize(fontSize);
    }

    if (type === "lineHeightChange" && typeof lineHeight === "number") {
      applyLineHeight(lineHeight);
    }

    if (type === "fontFamilyChange" && typeof fontFamily === "string") {
      applyFontFamily(fontFamily);
    }

    if (type === "contentWidthChange" && typeof contentWidth === "number") {
      applyContentWidth(contentWidth);
    }

    if (type === "showToolbarChange" && typeof showToolbar === "boolean") {
      applyShowToolbar(showToolbar);
    }

    if (type === "toggleSearch") {
      toggleSearchBar();
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

/**
 * Mermaid preview integration for Milkdown Crepe's built-in
 * code-block renderPreview API.
 *
 * Problem: Crepe's code-block component passes preview content
 * through `DOMPurify.sanitize()`, which strips `<foreignObject>`
 * elements — the mechanism mermaid v11 uses for ALL text labels.
 *
 * Solution: Pass a lightweight placeholder to `applyPreview` so
 * Crepe creates the preview panel.  A `MutationObserver` detects
 * the placeholder entering the DOM, then replaces it with the
 * real mermaid SVG via direct `innerHTML` — completely bypassing
 * DOMPurify.
 *
 * Zoom/pan controls are added in the same observer pass.
 */

import { renderMermaidDiagram, resetMermaidTheme } from './mermaid-renderer';
import { getMermaidTheme, invalidateMermaidThemeCache } from './mermaid-themes';

// ---------------------------------------------------------------------------
// Pending render store — keyed by a unique render-id
// ---------------------------------------------------------------------------
let nextRenderId = 0;
const pendingSvgs = new Map<string, string>();
/** Mermaid definitions keyed by render ID — used for re-rendering on theme change. */
const mermaidDefinitions = new Map<string, string>();

/** Current extension theme ID — set externally via setActiveTheme(). */
let activeTheme = 'vscode';

/**
 * Set the active extension theme. After calling this, newly
 * rendered (or re-rendered) mermaid diagrams will use the
 * updated theme.
 */
export function setActiveTheme(themeId: string): void {
  activeTheme = themeId;
  resetMermaidTheme();
  invalidateMermaidThemeCache();
}

/**
 * Re-render all existing mermaid diagrams in place with the current theme.
 * Called on theme change to avoid a full document re-render.
 */
export async function reRenderMermaidDiagrams(): Promise<void> {
  const viewers = document.querySelectorAll<HTMLElement>('.mermaid-viewer[data-mermaid-init]');
  if (viewers.length === 0) return;

  const mermaidTheme = getMermaidTheme(activeTheme);
  for (const viewer of viewers) {
    const contentEl = viewer.querySelector<HTMLElement>('.mermaid-content');
    const renderId = viewer.dataset.mermaidRenderId;
    if (!contentEl || !renderId) continue;

    const definition = mermaidDefinitions.get(renderId);
    if (!definition) continue;

    try {
      const { svg, isError } = await renderMermaidDiagram(definition, mermaidTheme);
      if (!isError) {
        contentEl.innerHTML = svg;
      }
    } catch {
      // Silently ignore re-render failures — diagram keeps its previous SVG
    }
  }
}

// ---------------------------------------------------------------------------
// renderPreview callback
// ---------------------------------------------------------------------------

/**
 * `renderPreview` callback compatible with Crepe's CodeMirror
 * feature config (`CodeBlockConfig.renderPreview`).
 */
export function mermaidRenderPreview(
  language: string,
  content: string,
  applyPreview: (value: null | string | HTMLElement) => void,
): void | null {
  if (language.toLowerCase() !== 'mermaid') {
    return null;
  }

  if (!content.trim()) {
    applyPreview(null);
    return;
  }

  const mermaidTheme = getMermaidTheme(activeTheme);
  const renderId = `mermaid-render-${++nextRenderId}`;
  // Store definition for potential re-render on theme change.
  mermaidDefinitions.set(renderId, content);

  // Async render
  renderMermaidDiagram(content, mermaidTheme).then(({ svg, isError }) => {
    if (isError) {
      // Errors are simple HTML with no foreignObject — safe to pass directly
      applyPreview(
        `<div class="mermaid-error-container">${svg}</div>`,
      );
    } else {
      // Store the real SVG for deferred injection.
      pendingSvgs.set(renderId, svg);
      // Clean up SVG entry after 30s if not consumed by hydrateViewer
      setTimeout(() => { pendingSvgs.delete(renderId); }, 30_000);

      // Pass a lightweight placeholder.  DOMPurify will allow these
      // simple elements through.  The MutationObserver picks up the
      // data-mermaid-render-id attribute and injects the real SVG.
      applyPreview(
        `<div class="mermaid-viewer" data-mermaid-render-id="${renderId}">`
        + `<div class="mermaid-toolbar">`
        +   `<button class="mermaid-btn" data-mermaid-action="zoom-in" title="Zoom in">`
        +     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`
        +   `</button>`
        +   `<button class="mermaid-btn" data-mermaid-action="zoom-out" title="Zoom out">`
        +     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`
        +   `</button>`
        +   `<button class="mermaid-btn" data-mermaid-action="zoom-reset" title="Reset view">`
        +     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`
        +   `</button>`
        +   `<span class="mermaid-zoom-level">100%</span>`
        + `</div>`
        + `<div class="mermaid-canvas">`
        +   `<div class="mermaid-content"></div>`
        + `</div>`
        + `</div>`,
      );
    }
  });

  // Return undefined (void) → tells Crepe this is an async preview
}

// ---------------------------------------------------------------------------
// Zoom / Pan — MutationObserver wiring
// ---------------------------------------------------------------------------

const ZOOM_STEP = 0.15;
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

/**
 * Initialise the MutationObserver that watches for `.mermaid-viewer`
 * elements entering the DOM and:
 *   1. Injects the real mermaid SVG (bypassing DOMPurify)
 *   2. Attaches interactive zoom/pan behaviour
 *
 * Call once during startup (after Crepe.create()).
 */
export function initMermaidViewer(): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        const viewers = node.matches?.('.mermaid-viewer')
          ? [node]
          : Array.from(node.querySelectorAll('.mermaid-viewer'));
        for (const el of viewers) {
          hydrateViewer(el as HTMLElement);
        }
      }
    }
  });

  const observeTarget = document.getElementById('editor') || document.body;
  observer.observe(observeTarget, { childList: true, subtree: true });

  // Hydrate any viewers that already exist
  document.querySelectorAll<HTMLElement>('.mermaid-viewer').forEach(hydrateViewer);
}

/**
 * Inject the real SVG and attach zoom/pan to a `.mermaid-viewer`.
 */
function hydrateViewer(viewer: HTMLElement): void {
  // Guard against duplicate initialisation
  if (viewer.dataset.mermaidInit) return;
  viewer.dataset.mermaidInit = '1';

  const renderId = viewer.dataset.mermaidRenderId;
  const content = viewer.querySelector<HTMLElement>('.mermaid-content');

  // Inject the real SVG directly (bypasses DOMPurify)
  if (renderId && content) {
    const svg = pendingSvgs.get(renderId);
    if (svg) {
      content.innerHTML = svg;
      pendingSvgs.delete(renderId);
    }
  }

  setupZoomPan(viewer);
}

/** Attach zoom/pan to a single `.mermaid-viewer` element. */
function setupZoomPan(viewer: HTMLElement): void {
  const canvas = viewer.querySelector<HTMLElement>('.mermaid-canvas');
  const content = viewer.querySelector<HTMLElement>('.mermaid-content');
  const zoomLabel = viewer.querySelector<HTMLElement>('.mermaid-zoom-level');
  if (!canvas || !content) return;

  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  function applyTransform(): void {
    content!.style.transform =
      `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    if (zoomLabel) {
      zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    }
  }

  // ---- Button clicks (event delegation) --------------------------------
  viewer.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest('[data-mermaid-action]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    const action = btn.getAttribute('data-mermaid-action');
    if (action === 'zoom-in') {
      scale = Math.min(MAX_SCALE, scale + ZOOM_STEP);
    } else if (action === 'zoom-out') {
      scale = Math.max(MIN_SCALE, scale - ZOOM_STEP);
    } else if (action === 'zoom-reset') {
      scale = 1;
      translateX = 0;
      translateY = 0;
    }
    applyTransform();
  });

  // ---- Mouse-wheel zoom ------------------------------------------------
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale + delta));

      // Zoom toward the pointer position
      const rect = canvas!.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;

      const ratio = newScale / scale;
      translateX = pointerX - ratio * (pointerX - translateX);
      translateY = pointerY - ratio * (pointerY - translateY);
      scale = newScale;
      applyTransform();
    },
    { passive: false },
  );

  // ---- Pointer-drag panning --------------------------------------------
  let isPanning = false;
  let startX = 0;
  let startY = 0;

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return; // left-click only
    isPanning = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    canvas!.setPointerCapture(e.pointerId);
    canvas!.style.cursor = 'grabbing';
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isPanning) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    applyTransform();
  });

  const endPan = () => {
    isPanning = false;
    canvas!.style.cursor = '';
  };
  canvas.addEventListener('pointerup', endPan);
  canvas.addEventListener('pointercancel', endPan);
}

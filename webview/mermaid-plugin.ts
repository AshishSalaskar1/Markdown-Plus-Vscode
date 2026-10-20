/**
 * Mermaid preview integration for Milkdown Crepe's built-in
 * code-block renderPreview API.
 *
 * Problem: Crepe's code-block component passes preview content
 * through `DOMPurify.sanitize()`, which strips `<foreignObject>`
 * elements — the mechanism mermaid v11 uses for ALL text labels.
 *
 * Pass a lightweight placeholder to `applyPreview` so Crepe creates the
 * preview panel. A MutationObserver resolves its code block and installs a
 * persistent viewer, injecting Mermaid's SVG without stripping its labels.
 *
 * A persistent viewer per code block keeps the canvas and its controls alive
 * across preview updates. Editing reuses the block's existing CodeMirror view.
 */

import { renderMermaidDiagram, resetMermaidTheme } from './mermaid-renderer';
import { getMermaidTheme, invalidateMermaidThemeCache } from './mermaid-themes';

// ---------------------------------------------------------------------------
// Pending render store — keyed by a unique render-id
// ---------------------------------------------------------------------------
let nextRenderId = 0;
const pendingDefinitions = new Map<string, { definition: string; timer: ReturnType<typeof setTimeout> }>();
const blockViewers = new WeakMap<HTMLElement, ViewerState>();
const viewerStates = new WeakMap<HTMLElement, ViewerState>();
const RENDER_DELAY = 300;

interface ViewerState {
  viewer: HTMLElement;
  block: HTMLElement | null;
  content: HTMLElement;
  status: HTMLElement;
  definition?: string;
  theme: string;
  revision: number;
  timer?: ReturnType<typeof setTimeout>;
  running?: Promise<void>;
}

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
  await Promise.all(Array.from(viewers, async (viewer) => {
    const state = viewerStates.get(viewer);
    if (!state) return;
    clearTimeout(state.timer);
    state.timer = undefined;
    state.theme = getMermaidTheme(activeTheme);
    state.revision++;
    await renderViewer(state);
  }));
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

  const renderId = `mermaid-render-${++nextRenderId}`;
  const timer = setTimeout(() => pendingDefinitions.delete(renderId), 30_000);
  pendingDefinitions.set(renderId, { definition: content, timer });
  // Resolve ownership only after Milkdown mounts this placeholder. Its callback
  // has no block identity, and matching by source would confuse duplicate charts.
  applyPreview(`<div class="mermaid-placeholder" data-mermaid-render-id="${renderId}"></div>`);
}

// ---------------------------------------------------------------------------
// Zoom / Pan — MutationObserver wiring
// ---------------------------------------------------------------------------

const ZOOM_STEP = 0.15;
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

/**
 * Watch preview placeholders, attach the persistent viewer, and clean up
 * rendering work when its diagram is removed.
 *
 * Call once during startup (after Crepe.create()).
 */
export function initMermaidViewer(): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        const viewers = node.matches('.mermaid-placeholder')
          ? [node]
          : Array.from(node.querySelectorAll('.mermaid-placeholder'));
        for (const el of viewers) {
          hydrateViewer(el as HTMLElement);
        }
      }
    }
    // A preview update briefly removes its viewer; hydrate all replacements
    // before deciding whether a viewer was genuinely deleted.
    for (const mutation of mutations) {
      for (const node of mutation.removedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        const viewers = node.matches('.mermaid-viewer') ? [node] : node.querySelectorAll<HTMLElement>('.mermaid-viewer');
        for (const viewer of viewers) {
          if (viewer.isConnected) continue;
          const state = viewerStates.get(viewer);
          if (!state) continue;
          clearTimeout(state.timer);
          state.revision++;
          if (state.block) {
            state.block.classList.remove('mermaid-block', 'mermaid-editing');
            const host = state.block.querySelector<HTMLElement>('.codemirror-host');
            host?.removeAttribute('id');
            host?.querySelector('.cm-content')?.removeAttribute('aria-label');
            blockViewers.delete(state.block);
          }
          viewerStates.delete(viewer);
        }
      }
    }
  });

  const observeTarget = document.getElementById('editor') || document.body;
  observer.observe(observeTarget, { childList: true, subtree: true });

  // Hydrate any viewers that already exist
  document.querySelectorAll<HTMLElement>('.mermaid-placeholder').forEach(hydrateViewer);
}

/**
 * Associate a placeholder with its owning code block and update that viewer.
 */
function hydrateViewer(placeholder: HTMLElement): void {
  if (!placeholder.isConnected) return;
  const renderId = placeholder.dataset.mermaidRenderId!;
  const pending = pendingDefinitions.get(renderId);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingDefinitions.delete(renderId);

  const block = placeholder.closest<HTMLElement>('.milkdown-code-block');
  let state = block ? blockViewers.get(block) : undefined;
  const firstRender = !state;
  if (!state) {
    const viewer = createViewer();
    state = {
      viewer, block, revision: 0, theme: getMermaidTheme(activeTheme),
      content: viewer.querySelector<HTMLElement>('.mermaid-content')!,
      status: viewer.querySelector<HTMLElement>('.mermaid-status')!,
    };
    viewerStates.set(viewer, state);
    if (block) {
      blockViewers.set(block, state);
      block.classList.add('mermaid-block');
    }
    setupZoomPan(viewer);
    setupEditing(viewer, block, renderId);
  }
  // Only the SVG/status changes. Reuse both the CodeMirror and canvas DOM so
  // typing never loses focus, selection, undo history, or the zoom/pan position.
  placeholder.replaceWith(state.viewer);
  if (state.definition === pending.definition) return;
  state.definition = pending.definition;
  state.revision++;
  clearTimeout(state.timer);
  state.timer = undefined;
  if (firstRender) {
    void renderViewer(state);
  } else {
    const current = state;
    state.timer = setTimeout(() => {
      current.timer = undefined;
      void renderViewer(current);
    }, RENDER_DELAY);
  }
}

function createViewer(): HTMLElement {
  const viewer = document.createElement('div');
  viewer.className = 'mermaid-viewer';
  viewer.dataset.mermaidInit = '1';
  viewer.contentEditable = 'false';
  viewer.innerHTML = `<div class="mermaid-toolbar">
    <button type="button" class="mermaid-btn" data-mermaid-action="zoom-in" title="Zoom in" aria-label="Zoom in">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
    </button>
    <button type="button" class="mermaid-btn" data-mermaid-action="zoom-out" title="Zoom out" aria-label="Zoom out">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
    </button>
    <button type="button" class="mermaid-btn" data-mermaid-action="zoom-reset" title="Reset view" aria-label="Reset view">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
    </button>
    <span class="mermaid-zoom-level">100%</span>
    <button type="button" class="mermaid-btn mermaid-edit-btn" data-mermaid-action="edit" title="Edit Mermaid source" aria-expanded="false">EDIT</button>
  </div>
  <div class="mermaid-canvas"><div class="mermaid-content"></div></div>
  <div class="mermaid-status" role="status" aria-live="polite"></div>`;
  return viewer;
}

function setupEditing(viewer: HTMLElement, block: HTMLElement | null, renderId: string): void {
  const button = viewer.querySelector<HTMLButtonElement>('.mermaid-edit-btn')!;
  const host = block?.querySelector<HTMLElement>('.codemirror-host');
  if (!block || !host) {
    button.hidden = true;
    return;
  }
  host.id = `${renderId}-source`;
  button.setAttribute('aria-controls', host.id);
  const source = host.querySelector<HTMLElement>('.cm-content');
  source?.setAttribute('aria-label', 'Mermaid diagram source');
  button.addEventListener('click', () => {
    const editing = block.classList.toggle('mermaid-editing');
    button.textContent = editing ? 'DONE' : 'EDIT';
    button.title = editing ? 'Close Mermaid source (changes sync automatically)' : 'Edit Mermaid source';
    button.setAttribute('aria-expanded', String(editing));
    if (editing) source?.focus({ preventScroll: true });
  });
}

/** One active render and one latest pending update per diagram. */
function renderViewer(state: ViewerState): Promise<void> {
  if (state.running) return state.running;
  if (!state.viewer.isConnected) return Promise.resolve();
  const revision = state.revision;
  const definition = state.definition ?? '';
  state.viewer.setAttribute('aria-busy', 'true');
  if (!state.content.childElementCount && !state.status.textContent && definition.trim()) {
    state.status.textContent = 'Rendering diagram…';
  }
  state.running = (async () => {
    if (!definition.trim()) {
      state.content.replaceChildren();
      state.status.textContent = 'Enter Mermaid code to preview the diagram.';
      state.status.classList.remove('mermaid-error-container');
      return;
    }
    const { svg, isError } = await renderMermaidDiagram(definition, state.theme);
    if (revision !== state.revision || !state.viewer.isConnected) return;
    if (isError) {
      // Keep the last valid SVG visible while syntax is incomplete. The source
      // is already synced to the document, even when it cannot yet be rendered.
      state.status.innerHTML = svg;
      state.status.classList.add('mermaid-error-container');
    } else {
      state.content.innerHTML = svg;
      state.status.replaceChildren();
      state.status.classList.remove('mermaid-error-container');
    }
  })().finally(() => {
    state.running = undefined;
    state.viewer.setAttribute('aria-busy', 'false');
    if (revision !== state.revision && !state.timer && state.viewer.isConnected) return renderViewer(state);
  });
  return state.running;
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
  let animationFrame = 0;
  let displayedZoom = '100%';

  function applyTransform(): void {
    if (animationFrame) return;
    animationFrame = requestAnimationFrame(() => {
      animationFrame = 0;
      if (!viewer.isConnected) return;
      content!.style.transform =
        `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
      const label = `${Math.round(scale * 100)}%`;
      // Panning must not repeatedly replace text nodes (and wake observers).
      if (zoomLabel && label !== displayedZoom) {
        zoomLabel.textContent = label;
        displayedZoom = label;
      }
    });
  }

  function zoomAt(newScale: number, x: number, y: number): void {
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    const ratio = newScale / scale;
    translateX = x - ratio * (x - translateX);
    translateY = y - ratio * (y - translateY);
    scale = newScale;
    applyTransform();
  }

  // ---- Button clicks (event delegation) --------------------------------
  viewer.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest('[data-mermaid-action]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    const action = btn.getAttribute('data-mermaid-action');
    if (action === 'zoom-in') {
      zoomAt(scale + ZOOM_STEP, canvas!.clientWidth / 2, canvas!.clientHeight / 2);
    } else if (action === 'zoom-out') {
      zoomAt(scale - ZOOM_STEP, canvas!.clientWidth / 2, canvas!.clientHeight / 2);
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
      e.stopPropagation();
      if (e.deltaY === 0) return;
      // Trackpads send small, frequent pixel deltas; treating each as a full
      // zoom step makes them jump wildly. Normalize line/page wheel units too.
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas!.clientHeight : 1;
      const delta = Math.max(-100, Math.min(100, e.deltaY * unit));
      const newScale = scale * Math.exp(-delta * 0.002);

      // Zoom toward the pointer position
      const rect = canvas!.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;

      zoomAt(newScale, pointerX, pointerY);
    },
    { passive: false },
  );

  // ---- Pointer-drag panning --------------------------------------------
  let activePointer: number | null = null;
  let startX = 0;
  let startY = 0;

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || activePointer !== null) return;
    // Do not turn links inside diagrams into drag handles.
    if ((e.target as Element).closest('a')) return;
    e.preventDefault();
    e.stopPropagation();
    activePointer = e.pointerId;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    canvas!.setPointerCapture(e.pointerId);
    canvas!.style.cursor = 'grabbing';
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activePointer) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    applyTransform();
  });

  const endPan = (e: PointerEvent) => {
    if (e.pointerId !== activePointer) return;
    activePointer = null;
    if (canvas!.hasPointerCapture(e.pointerId)) {
      canvas!.releasePointerCapture(e.pointerId);
    }
    canvas!.style.cursor = '';
  };
  canvas.addEventListener('pointerup', endPan);
  canvas.addEventListener('pointercancel', endPan);
  canvas.addEventListener('lostpointercapture', endPan);
}

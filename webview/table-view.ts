import type { EditorView } from '@milkdown/prose/view';

/** Keep normal cell clicks on ProseMirror's native, synchronous caret path. */
export function stabilizeTableCellSelection(view: EditorView): void {
  const original = view.props.nodeViews?.table;
  if (!original) return;
  view.setProps({
    nodeViews: {
      ...view.props.nodeViews,
      table(node, editorView, getPos, decorations, innerDecorations) {
        const nodeView = original(node, editorView, getPos, decorations, innerDecorations);
        const stopEvent = nodeView.stopEvent?.bind(nodeView);
        nodeView.stopEvent = (event) => {
          if ((event.type === 'pointerdown' || event.type === 'mousedown') &&
              event.target instanceof Element && event.target.closest('td, th') &&
              !event.target.closest('button')) {
            // Milkdown 7.18 schedules a NodeSelection with a captured EditorState
            // on cell clicks. Typing before that frame runs throws "Applying a
            // mismatched transaction" and can leave Tab outside the table.
            // Native ProseMirror selection supports typing and cell navigation
            // without replaying that stale transaction. Table buttons and drag
            // gestures retain the component's original handling.
            return false;
          }
          return stopEvent?.(event) ?? false;
        };
        return nodeView;
      },
    },
  });
}

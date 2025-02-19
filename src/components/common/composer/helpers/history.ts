export function createHistory() {
  return {
    undoStack: [] as Array<{ text: string; caretOffset: number }>,
    redoStack: [] as Array<{ text: string; caretOffset: number }>,
    maxSize: 100,
    isUndoRedoAction: false,
    pendingOperations: [] as Array<{ text: string; caretOffset: number }>,
    batchTimeout: null as number | null,
    batchDelay: 200,

    push(text: string, caretOffset: number) {
      if (this.isUndoRedoAction) {
        return;
      }

      if (this.undoStack.length === 0) {
        this.undoStack.push({ text, caretOffset });
        return;
      }

      this.pendingOperations.push({ text, caretOffset });

      if (this.batchTimeout !== null) {
        window.clearTimeout(this.batchTimeout);
      }

      this.batchTimeout = window.setTimeout(() => {
        this.commitBatch();
      }, this.batchDelay);
    },

    commitBatch() {
      if (this.pendingOperations.length === 0) {
        return;
      }

      const lastOperation = this.pendingOperations[this.pendingOperations.length - 1];

      this.undoStack.push(lastOperation);
      this.redoStack = [];

      if (this.undoStack.length > this.maxSize)
        this.undoStack.shift();

      this.pendingOperations = [];
      this.batchTimeout = null;
    },

    undo(): { text: string; caretOffset: number } | null {
      this.commitBatch();

      if (this.undoStack.length < 2) {
        return null;
      }

      const current = this.undoStack.pop()!;
      this.redoStack.push(current);
      return this.undoStack[this.undoStack.length - 1];
    },

    redo(): { text: string; caretOffset: number } | null {
      this.commitBatch();

      if (!this.redoStack.length)
        return null;

      const state = this.redoStack.pop()!;
      this.undoStack.push(state);
      return state;
    },
  };
}

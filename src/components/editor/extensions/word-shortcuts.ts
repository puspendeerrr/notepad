import { Extension } from '@tiptap/core';

export interface WordShortcutsOptions {
  onSave?: () => void;
  onPrint?: () => void;
  onOpenLink?: () => void;
  onOpenFind?: () => void;
  onFindNext?: () => void;
}

export const WordShortcuts = Extension.create<WordShortcutsOptions>({
  name: 'wordShortcuts',

  addOptions() {
    return {
      onSave: undefined,
      onPrint: undefined,
      onOpenLink: undefined,
      onOpenFind: undefined,
      onFindNext: undefined,
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-b': () => this.editor.commands.toggleBold(),
      'Mod-i': () => this.editor.commands.toggleItalic(),
      'Mod-u': () => this.editor.commands.toggleUnderline(),
      'Mod-k': () => {
        if (this.options.onOpenLink) {
          this.options.onOpenLink();
          return true;
        }
        return false;
      },
      'Mod-z': () => this.editor.commands.undo(),
      'Mod-y': () => this.editor.commands.redo(),
      'Mod-Shift-z': () => this.editor.commands.redo(),
      'Mod-s': () => {
        if (this.options.onSave) {
          this.options.onSave();
          return true;
        }
        return false;
      },
      'Mod-p': () => {
        if (this.options.onPrint) {
          this.options.onPrint();
          return true;
        }
        return false;
      },
      'Mod-f': () => {
        if (this.options.onOpenFind) {
          this.options.onOpenFind();
          return true;
        }
        return false;
      },
      'Mod-h': () => {
        if (this.options.onOpenFind) {
          this.options.onOpenFind();
          return true;
        }
        return false;
      },
      'Mod-g': () => {
        if (this.options.onFindNext) {
          this.options.onFindNext();
          return true;
        }
        return false;
      },
      'Mod-Shift-l': () => this.editor.commands.toggleBulletList(),
      'Mod-Shift-7': () => this.editor.commands.toggleOrderedList(),
      'Mod-Alt-1': () => this.editor.commands.toggleHeading({ level: 1 }),
      'Mod-Alt-2': () => this.editor.commands.toggleHeading({ level: 2 }),
      'Mod-Alt-3': () => this.editor.commands.toggleHeading({ level: 3 }),
      'Mod-l': () => this.editor.commands.setTextAlign('left'),
      'Mod-e': () => this.editor.commands.setTextAlign('center'),
      'Mod-r': () => this.editor.commands.setTextAlign('right'),
      'Mod-j': () => this.editor.commands.setTextAlign('justify'),
    };
  },
});

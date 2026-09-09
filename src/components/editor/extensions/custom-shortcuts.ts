import { Extension, wrappingInputRule } from '@tiptap/core';

export const CustomListRules = Extension.create({
  name: 'customListRules',

  addInputRules() {
    const rules = [];

    // Support typing '[] ' directly for task lists
    if (this.editor.schema.nodes.taskList && this.editor.schema.nodes.taskItem) {
      rules.push(
        wrappingInputRule({
          find: /^\s*\[\]\s$/,
          type: this.editor.schema.nodes.taskList,
        })
      );
    }

    return rules;
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        // First try to sink in list (nest list item)
        if (this.editor.can().sinkListItem('listItem')) {
          return this.editor.commands.sinkListItem('listItem');
        }
        if (this.editor.can().sinkListItem('taskItem')) {
          return this.editor.commands.sinkListItem('taskItem');
        }
        // In a table, Tab moves to next cell
        if (this.editor.can().goToNextCell()) {
          return this.editor.commands.goToNextCell();
        }
        // Otherwise insert 2 spaces
        return this.editor.commands.insertContent('  ');
      },
      'Shift-Tab': () => {
        // Outdent list item
        if (this.editor.can().liftListItem('listItem')) {
          return this.editor.commands.liftListItem('listItem');
        }
        if (this.editor.can().liftListItem('taskItem')) {
          return this.editor.commands.liftListItem('taskItem');
        }
        // In a table, Shift-Tab moves to previous cell
        if (this.editor.can().goToPreviousCell()) {
          return this.editor.commands.goToPreviousCell();
        }
        return false;
      },
    };
  },
});

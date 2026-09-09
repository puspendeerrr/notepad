import Image from '@tiptap/extension-image';
import { mergeAttributes } from '@tiptap/core';

export const CustomImage = Image.extend({
  name: 'image',

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '100%',
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return {
            style: `width: ${attributes.width}; max-width: 100%; height: auto;`,
          };
        },
      },
      alignment: {
        default: 'center',
        renderHTML: (attributes) => {
          return {
            'data-alignment': attributes.alignment || 'center',
          };
        },
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const alignment = HTMLAttributes['data-alignment'] || 'center';
    let wrapperClass = 'flex my-4 ';
    if (alignment === 'left') wrapperClass += 'justify-start';
    else if (alignment === 'right') wrapperClass += 'justify-end';
    else wrapperClass += 'justify-center';

    return [
      'div',
      { class: wrapperClass },
      [
        'img',
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          class: 'rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all',
        }),
      ],
    ];
  },
});

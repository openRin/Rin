import { defaultValueCtx, Editor, editorViewOptionsCtx, rootCtx } from '@milkdown/core';
import { clipboard } from '@milkdown/plugin-clipboard';
import { history } from '@milkdown/plugin-history';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { Milkdown, useEditor } from '@milkdown/react';
import { rin } from './theme';

export function MilkdownEditor({ data, readonly = false }: { data?: string, readonly: boolean }) {
    const markdown = data || localStorage.getItem('markdown') || '写点什么吧';

    useEditor((root) => {
        return Editor
            .make()
            .config(ctx => {
                root.focus()
                ctx.update(editorViewOptionsCtx, (prev) => ({
                    ...prev,
                    editable: () => !readonly,
                }))
                ctx.set(rootCtx, root)
                ctx.set(defaultValueCtx, markdown)
                const listener = ctx.get(listenerCtx);

                listener.markdownUpdated((_, markdown, prevMarkdown) => {
                    if (!readonly && markdown !== prevMarkdown) {
                        localStorage.setItem('markdown', markdown);
                    }
                })
            })
            .config(rin)
            .use(commonmark)
            .use(gfm)
            .use(history)
            .use(clipboard)
            .use(listener)
    }, [])

    return <Milkdown />
}

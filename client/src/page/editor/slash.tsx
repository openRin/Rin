import { editorViewCtx } from "@milkdown/core"
import { Ctx } from "@milkdown/ctx"
import { slashFactory, SlashProvider } from "@milkdown/plugin-slash"
import { createCodeBlockCommand } from "@milkdown/preset-commonmark"
import { useInstance } from '@milkdown/react'
import { callCommand } from "@milkdown/utils"
import { usePluginViewContext } from "@prosemirror-adapter/react"
import { useCallback, useEffect, useRef } from "react"

export const slash = slashFactory('Commands');

export const SlashView = () => {
    const ref = useRef<HTMLDivElement>(null)
    const slashProvider = useRef<SlashProvider>()

    const { view, prevState } = usePluginViewContext()
    const [loading, get] = useInstance()
    const action = useCallback((fn: (ctx: Ctx) => void) => {
        if (loading) return;
        get().action(fn)
    }, [loading])

    useEffect(() => {
        const div = ref.current
        if (loading || !div) {
            return;
        }
        slashProvider.current = new SlashProvider({
            content: div,
            tippyOptions: {
                onMount: (_) => {
                    (ref.current?.children[0] as HTMLButtonElement).focus();
                }
            },
            trigger: '@',
        })

        return () => {
            slashProvider.current?.destroy()
        }
    }, [loading])

    useEffect(() => {
        slashProvider.current?.update(view, prevState)
    })

    const command = (e: React.KeyboardEvent | React.MouseEvent) => {
        if (e.type === 'keydown' && (e as React.KeyboardEvent).key != 'Enter') {
            // move focus to the editor
            action((ctx) => {
                const view = ctx.get(editorViewCtx);
                view.focus()
            })
            return;
        }
        e.preventDefault() // Prevent the keyboad key to be inserted in the editor.
        action((ctx) => {
            const view = ctx.get(editorViewCtx);
            const { dispatch, state } = view;
            const { tr, selection } = state;
            const { from } = selection;
            dispatch(tr.deleteRange(from - 1, from))
            view.focus()
            return callCommand(createCodeBlockCommand.key)(ctx)
        })
    }

    return (
        <div data-desc="This additional wrapper is useful for keeping slash component during HMR" aria-expanded="false">
            <div ref={ref} aria-expanded="false">
                <button
                    className="text-gray-600 bg-slate-200 px-2 py-1 rounded-lg hover:bg-slate-300 border hover:text-gray-900"
                    onKeyDown={(e) => command(e)}
                    onMouseDown={(e) => { command(e)}}
                >
                    Code Block
                </button>
            </div>
        </div>
    )
}

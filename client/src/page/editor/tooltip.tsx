import { Ctx } from "@milkdown/ctx"
import { tooltipFactory, TooltipProvider } from "@milkdown/plugin-tooltip"
import { toggleStrongCommand } from "@milkdown/preset-commonmark"
import { useInstance } from '@milkdown/react'
import { usePluginViewContext } from "@prosemirror-adapter/react"
import { useCallback, useEffect, useRef } from "react"
import { callCommand } from "@milkdown/utils"

export const tooltip = tooltipFactory('Text');

export const TooltipView = () => {
    const ref = useRef<HTMLDivElement>(null)
    const tooltipProvider = useRef<TooltipProvider>()

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
        tooltipProvider.current = new TooltipProvider({
            content: div,
        })

        return () => {
            tooltipProvider.current?.destroy()
        }
    }, [loading])

    useEffect(() => {
        tooltipProvider.current?.update(view, prevState)
    })

    return (
        <div data-desc="This additional wrapper is useful for keeping tooltip component during HMR">
            <div ref={ref}>
                <button
                    className="text-gray-600 bg-slate-200 px-2 py-1 rounded-lg hover:bg-slate-300 border hover:text-gray-900"
                    onMouseDown={(e) => {
                        // Use `onMouseDown` with `preventDefault` to prevent the editor from losing focus.
                        e.preventDefault()

                        action(callCommand(toggleStrongCommand.key))
                    }}
                >
                    Bold
                </button>
            </div>
        </div>
    )
}

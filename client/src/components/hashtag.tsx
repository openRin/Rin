import { useLocation } from "wouter"

/**
 * 话题标签。interactive=false 渲染为静态 <span>，用于包在 <button> 里的预览卡片
 * —— 嵌套 <button> 属非法 HTML，浏览器重写 DOM 会让 React 报 hooks 错误。
 */
export function HashTag({ name, interactive = true }: { name: string; interactive?: boolean }) {
    const [, setLocation] = useLocation()

    const className = "max-w-full min-w-0 text-base t-secondary hover:text-theme text-pretty"
    const content = (
        <div className="flex min-w-0 gap-0.5">
            <div className="shrink-0 text-sm italic opacity-70">#</div>
            <div className="min-w-0 truncate text-sm opacity-70">
                {name}
            </div>
        </div>
    )

    if (!interactive) {
        return <span className={className}>{content}</span>
    }

    return (
        <button onClick={(e) => { e.preventDefault(); setLocation(`/hashtag/${name}`) }}
            className={className} >
            {content}
        </button >
    )
}

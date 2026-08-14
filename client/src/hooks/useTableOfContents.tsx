import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface TableOfContent {
    index: number
    text: string
    marginLeft: number
    element: HTMLElement
}

const getHeaderScrollOffset = () => {
    const rawValue = getComputedStyle(document.documentElement)
        .getPropertyValue('--header-scroll-offset')
        .trim()
    const offset = Number.parseFloat(rawValue)
    return Number.isFinite(offset) ? offset : 0
}

const useTableOfContents = (selector: string) => {
    const intersectingListRef = useRef<boolean[]>([]) // isIntersecting array
    const [tableOfContents, setTableOfContents] = useState<TableOfContent[]>([])
    const [activeIndex, setActiveIndex] = useState(0)
    const { t } = useTranslation()
    const io = useRef<IntersectionObserver | null>(null);
    const mutationObserver = useRef<MutationObserver | null>(null);
    const [ref, setRef] = useState("-1")
    const lastRef = useRef("")

    useEffect(() => {
        if (lastRef.current === ref) return
        const content = document.querySelector(selector)
        if (!content) return

        const buildToc = () => {
            const intersectingList = intersectingListRef.current
            const headers = content.querySelectorAll<HTMLElement>(
                'h1, h2, h3, h4, h5, h6'
            )
            if (headers.length === 0) return

            // set TableOfContents
            const tocData = Array.from(headers).map<TableOfContent>((header, i) => ({
                index: i,
                text: header.textContent || '',
                marginLeft: (Number(header.tagName.charAt(1)) - 1) * 10,
                element: header, // have to down little bit
            }))
            setTableOfContents(tocData)

            // create IntersectionObserver
            if (io.current) io.current.disconnect()
            io.current = new IntersectionObserver(
                (entries) => {
                    // save isIntersecting info to array using data-id
                    entries.forEach(({ target, isIntersecting }) => {
                        const idx = Number((target as HTMLElement).dataset.id || 0)
                        intersectingList[idx] = isIntersecting
                    })
                    // get activeIndex
                    const currentIndex = intersectingList.findIndex((item) => item)
                    let activeIndex = currentIndex - 1
                    if (currentIndex === -1) {
                        activeIndex = intersectingList.length - 1
                    } else if (currentIndex === 0) {
                        activeIndex = 0
                    }
                    setActiveIndex(activeIndex)
                },
                { rootMargin: "-20% 0px 10000px 0px", threshold: 0 }
            )
            intersectingList.length = 0 // reset array
            headers.forEach((header, i) => {
                if (header.getAttribute('data-id') !== null) return
                header.setAttribute('data-id', i.toString()) // set data-id
                intersectingList.push(false) // increase array length
                io.current!.observe(header) // register to observe
            })
        }

        // 首次尝试
        buildToc()

        // Markdown 是异步渲染的：监听内容变化，标题出现后重建
        if (mutationObserver.current) mutationObserver.current.disconnect()
        mutationObserver.current = new MutationObserver(() => {
            buildToc()
        })
        mutationObserver.current.observe(content, { childList: true, subtree: true })

        lastRef.current = ref
        return () => {
            if (io.current) io.current.disconnect()
            if (mutationObserver.current) mutationObserver.current.disconnect()
        }
    }, [ref])

    const cleanup = (newId: string) => {
        // 用递增时间戳强制触发 effect 重扫（绕过 lastRef 短路问题）
        setRef(`${newId}:${Date.now()}`)
        if (io.current) io.current.disconnect()
    }

    return {
        TOC: () => (
            <nav className="toc-nav">
                <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500">
                    {t("index.title")}
                </p>
                <ul className="space-y-[3px] border-l border-black/10 dark:border-white/10">
                    {tableOfContents.length === 0 && (
                        <li className="py-1.5 pl-4 text-[13px] leading-6 text-neutral-400 dark:text-neutral-500">{t("index.empty.title")}</li>
                    )}
                    {tableOfContents.map((item) => (
                        <li
                            key={`toc$${item.index}`}
                            className={`group relative cursor-pointer text-[13px] leading-6 transition-colors duration-150 ${
                                activeIndex === item.index
                                    ? "font-medium text-theme"
                                    : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                            }`}
                            style={{ paddingLeft: `calc(1rem + ${item.marginLeft}px)` }}
                            onClick={() => {
                                const top = item.element.getBoundingClientRect().top + window.scrollY - getHeaderScrollOffset()
                                window.scrollTo({
                                    top: Math.max(top, 0),
                                    behavior: 'smooth'
                                })
                            }}
                        >
                            <span
                                className={`absolute -left-px top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-theme transition-opacity duration-150 ${
                                    activeIndex === item.index ? "opacity-100" : "opacity-0"
                                }`}
                            />
                            <span className={`block py-1 transition-colors ${activeIndex === item.index ? "text-theme" : ""}`}>
                                {item.text}
                            </span>
                        </li>
                    ))}
                </ul>
            </nav>
        ), cleanup
    }
}

export default useTableOfContents

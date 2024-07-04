import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type TOCItem = {
    level: number;
    title: string;
    id: string;
    children?: TOCItem[];
};

export function TableOfContents({ selector, maxDepth = 3 }: { selector: string, maxDepth?: number }) {
    const { t } = useTranslation();
    const [intersecting, setIntersecting] = useState<string[]>();
    const [lastIntersecting, setLastIntersecting] = useState<string>();
    const [toc, setToc] = useState<TOCItem[]>([]);

    useEffect(() => {
        const element = document.querySelector(selector);
        if (!element) return;
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    setIntersecting((prev) => {
                        if (prev && prev[prev.length - 1] === id) {
                            return prev;
                        }
                        return [...(prev || []), id];
                    });
                } else {
                    setIntersecting((prev) => {
                        if (!prev) return prev;
                        const headings = Array.from(element.querySelectorAll('h1, h2, h3, h4, h5, h6'));
                        if (prev.length === 1) {
                            if (entry.boundingClientRect.y > 10) {
                                const current = prev[0]
                                let last: string = ""
                                for (const item of headings) {
                                    if (item.id === current) {
                                        break
                                    }
                                    last = item.id
                                }
                                setLastIntersecting(last)
                            } else {
                                setLastIntersecting(prev[0])
                            }
                        }
                        return prev.filter((id) => id !== entry.target.id);
                    });
                }
            });
        }, {
            threshold: [0.05, 1, 0]
        });
        function genTOC(element: Element) {
            const headings = Array.from(element.querySelectorAll('h1, h2, h3, h4, h5, h6'));
            const toc: TOCItem[] = [];
            let last: TOCItem | undefined;
            headings.forEach((heading) => {
                io.observe(heading);
                const level = parseInt(heading.tagName.slice(1));
                const title = heading.textContent || '';
                const id = heading.id;
                const item: TOCItem = { level, title, id };
                if (!last) {
                    toc.push(item);
                } else if (last.level < level) {
                    if (!last.children) {
                        last.children = [];
                    }
                    last.children.push(item);
                } else if (last.level === level) {
                    toc.push(item);
                } else {
                    let parent = toc[toc.length - 1];
                    let i = toc.length - 1;
                    while (parent && parent.level >= level) {
                        parent = toc[i--];
                    }
                    if (!parent) {
                        toc.push(item);
                    } else {
                        if (!parent.children) {
                            parent.children = [];
                        }
                        parent.children.push(item);
                    }
                }
                last = item;
            });
            setToc(toc);
        }
        const timer = setTimeout(() => {
            genTOC(element);
        }, 100)
        return () => {
            clearTimeout(timer)
            const headings = Array.from(element.querySelectorAll('h1, h2, h3, h4, h5, h6'));
            headings.forEach((heading) => {
                io.unobserve(heading);
            })
            element.removeEventListener('change', () => { });
        }
    }, []);
    return (
        <div>
            <h2 className="text-lg font-bold">{t("index.title")}</h2>
            <ul>
                {toc.length === 0 &&
                    <p className="t-secondary">{t("index.empty.title")}</p>
                }
                {toc.map((item) => (
                    <TOCItem key={item.id} item={item} maxDepth={maxDepth} intersecting={intersecting || []} lastIntersecting={lastIntersecting} />
                ))}
            </ul>
        </div>
    );
}

function TOCItem({ item, maxDepth, intersecting, lastIntersecting, enabled = true }: { item: TOCItem, maxDepth?: number, intersecting: string[], lastIntersecting?: string, enabled?: boolean }) {
    const isIntersecting = intersecting[0] === item.id || (intersecting.length === 0 && lastIntersecting === item.id)
    return (
        <li>
            <a className={isIntersecting && enabled ? "text-theme" : ""} href={`#${item.id}`}
                onClick={(e) => {
                    e.preventDefault()
                    document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" })
                }}
            >
                {item.title}</a>
            {item.children && item.level < (maxDepth || 6) && (
                <ul className="ml-2">
                    {item.children.map((child) => (
                        <TOCItem key={child.id} item={child} maxDepth={maxDepth} intersecting={intersecting} lastIntersecting={lastIntersecting} enabled={enabled && !isIntersecting} />
                    ))}
                </ul>
            )}
        </li>
    );
}
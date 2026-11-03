import {useEffect, useRef, useState} from "react"
import {Helmet} from 'react-helmet'
import {Link} from "wouter"
import {Waiting} from "../components/loading"
import { client } from "../app/runtime"
import {useSiteConfig} from "../hooks/useSiteConfig";
import {siteName} from "../utils/constants"
import {useTranslation} from "react-i18next";

interface FeedItem {
    id: number;
    createdAt: Date;
    title: string | null;
}

export function TimelinePage() {
    const [feeds, setFeeds] = useState<Partial<Record<number, FeedItem[]>>>()
    const [length, setLength] = useState(0)
    const ref = useRef(false)
    const { t } = useTranslation()
    const siteConfig = useSiteConfig();
    function fetchFeeds() {
        client.feed.timeline()
        .then(({ data }) => {
            if (data) {
                const arr = Array.isArray(data) ? data : []
                setLength(arr.length)
                // 兼容的分组逻辑
                const groups = (Object.groupBy
                    ? Object.groupBy(arr, ({ createdAt }) => new Date(createdAt).getFullYear())
                    : arr.reduce<Record<number, any[]>>((acc, item) => {
                        const key = new Date(item.createdAt).getFullYear()
                        ;(acc[key] ||= []).push(item)
                        return acc
                    }, {})
                )

                setFeeds(groups as any)
            }
        })
        .catch(err => {
            console.error("fetchFeeds error:", err)
        })
    }

    useEffect(() => {
        if (ref.current) return
        fetchFeeds()
        ref.current = true
    }, [])
    return (
        <>
            <Helmet>
                <title>{`${t('timeline')} - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('timeline')} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={feeds}>
                <main className="w-full flex flex-col justify-center items-center mb-8 ani-show">
                    <div className="wauto text-start text-black dark:text-white py-4 text-4xl font-bold">
                        <p>
                            {t('timeline')}
                        </p>
                        <div className="flex flex-row justify-between">
                            <p className="text-sm mt-4 text-neutral-500 font-normal">
                                {t('article.total$count', { count: length })}
                            </p>
                        </div>
                    </div>
                    {feeds && Object.keys(feeds).sort((a, b) => parseInt(b) - parseInt(a)).map(year => (
                        <div key={year} className="wauto flex flex-col justify-center items-start">
                            <h1 className="flex flex-row items-center space-x-2">
                                <span className="text-2xl font-bold t-primary ">
                                    {t('year$year', { year: year })}
                                </span>
                                <span className="text-sm t-secondary">
                                    {t('article.total_short$count', { count: feeds[+year]?.length })}
                                    </span>
                            </h1>
                            <div className="w-full flex flex-col justify-center items-start my-4">
                                {feeds[+year]?.map(({ id, title, createdAt }, index) => (
                                    <FeedItem key={id} id={id.toString()} title={title || t('unlisted')}
                                              createdAt={new Date(createdAt)}
                                              index={index}
                                              isLast={index === (feeds[+year]?.length ?? 0) - 1}/>
                                ))}
                            </div>
                        </div>
                    ))}
                </main>
            </Waiting>
        </>
    )
}

export function FeedItem({ id, title, createdAt, isLast, index = 0 }: { id: string, title: string, createdAt: Date, isLast?: boolean, index?: number }) {
    const formatter = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: '2-digit' });
    return (
        <div className="relative flex min-w-0 flex-row items-center pb-6 last:pb-0">
            {!isLast && (
                <div className="absolute left-[9px] top-5 bottom-0 w-px bg-theme/30"></div>
            )}
            <div className="relative z-10 h-[18px] w-[18px] shrink-0">
                <div
                    className="timeline-ripple absolute inset-0 rounded-full bg-theme"
                    style={{ animationDelay: `${(index % 6) * 0.3}s` }}
                ></div>
                <div className="relative flex h-[18px] w-[18px] items-center justify-center rounded-full bg-theme ring-4 ring-[rgb(var(--rin-canvas-rgb))]">
                    <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5 text-white">
                        <path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
            </div>
            <div className="ml-4 flex min-w-0 flex-1 flex-row items-center space-x-4 duration-300">
                <span className="shrink-0 text-sm t-secondary" title={new Date(createdAt).toLocaleString()}>
                    {formatter.format(new Date(createdAt))}
                </span>
                <Link href={`/feed/${id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 break-words text-base t-primary hover:text-theme text-pretty [overflow-wrap:anywhere]">
                    {title}
                </Link>
            </div>
        </div>
    )
}

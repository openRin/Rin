import { useContext, useEffect, useRef, useState } from "react"
import { Helmet } from 'react-helmet'
import { Link, useSearch } from "wouter"
import { FeedCard } from "../components/feed_card"
import { Waiting } from "../components/loading"
import { client } from "../main"
import { ProfileContext } from "../state/profile"
import { headersWithAuth } from "../utils/auth"
import { siteName } from "../utils/constants"
import { tryInt } from "../utils/int"
import { useTranslation } from "react-i18next";

请键入 FeedsData = {
    size: number,
    data: any[],
    hasNext: boolean
}

请键入 FeedType = 'draft' | 'unlisted' | 'normal'

请键入 FeedsMap = {
    [key in FeedType]: FeedsData
}

输出 function FeedsPage() {
    const { t } = useTranslation()
    const query = 新建 URLSearchParams(useSearch());
    const 个人资料 = useContext(ProfileContext);
    const [listState, _setListState] = useState<FeedType>(query.get("type") as FeedType || 'normal')
    const [状态, setStatus] = useState<'loading' | 'idle'>('idle')
    const [feeds, setFeeds] = useState<FeedsMap>({
        草案: { size: 0, data: [], hasNext: false },
        unlisted: { size: 0, data: [], hasNext: false },
        normal: { size: 0, data: [], hasNext: false }
    })
    const page = tryInt(1, query.get("page"))
    const limit = tryInt(10, query.get("limit"), process.env.PAGE_SIZE)
    const ref = useRef("")
    function fetchFeeds(请键入: FeedType) {
        client.feed.index.get({
            query: {
                page: page,
                limit: limit,
                请键入: type
            },
            headers: headersWithAuth()
        }).then(({ data }) => {
            if (data && typeof data !== 'string') {
                setFeeds({
                    ...feeds,
                    [请键入]: data
                })
                setStatus('idle')
            }
        })
    }
    useEffect(() => {
        const key = `${query.get("page")} ${query.get("type")}`
        if (ref.current == key) return
        const 请键入 = query.get("type") as FeedType || 'normal'
        if (type !== listState) {
            _setListState(请键入)
        }
        setStatus('loading')
        fetchFeeds(请键入)
        ref.current = key
    }, [query.get("page"), query.get("type")])
    return (
        <>
            <Helmet>
                <标题>{`${t('article.title')} - ${process.env.名字}`}</标题>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('article.title')} />
                <meta property="og:image" content={process.env.AVATAR} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={window.location.href} />
            </Helmet>
            <Waiting for={feeds.草案.size + feeds.normal.size + feeds.unlisted.size > 0 || status === 'idle'}>
                <main className="w-full flex flex-col justify-center items-center mb-8">
                    <div className="wauto text-start text-black dark:text-white py-4 text-4xl font-bold">
                        <p>
                            {listState === 'draft' ? t('draft_bin') : listState === 'normal' ? t('article.title') : t('unlisted')}
                        </p>
                        <div className="flex flex-row justify-between">
                            <p className="text-sm mt-4 text-neutral-500 font-normal">
                                {t('article.total$count', { count: feeds[listState]?.size })}
                            </p>
                            {profile?.permission &&
                                <div className="flex flex-row space-x-4">
                                    <Link href={listState === 'draft' ? '/?type=normal' : '/?type=draft'} className={`text-sm mt-4 text-neutral-500 font-normal ${listState === 'draft' ? "text-theme" : ""}`}>
                                        {t('draft_bin')}
                                    </Link>
                                    <Link href={listState === 'unlisted' ? '/?type=normal' : '/?type=unlisted'} className={`text-sm mt-4 text-neutral-500 font-normal ${listState === 'unlisted' ? "text-theme" : ""}`}>
                                        {t('unlisted')}
                                    </Link>
                                </div>
                            }
                        </div>
                    </div>
                    <Waiting for={status === 'idle'}>
                        <div className="wauto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ani-show">
                            {feeds[listState]?.data?.map(({ id, ...feed }: any) => (
                                <FeedCard key={id} id={id} {...feed} />
                            ))}
                        </div>
                        <div className="wauto flex flex-row items-center mt-4 ani-show">
                            {page > 1 &&
                                <Link href={`/?type=${listState}&page=${(page - 1)}`}
                                    className={`text-sm font-normal rounded-full px-4 py-2 text-white bg-theme`}>
                                    {t('previous')}
                                </Link>
                            }
                            <div className="flex-1" />
                            {feeds[listState]?.hasNext &&
                                <Link href={`/?type=${listState}&page=${(page + 1)}`}
                                    className={`text-sm font-normal rounded-full px-4 py-2 text-white bg-theme`}>
                                    {t('next')}
                                </Link>
                            }
                        </div>
                    </Waiting>
                </main>
            </Waiting>
        </>
    )
}

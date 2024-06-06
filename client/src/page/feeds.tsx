import { useContext, useEffect, useRef, useState } from "react"
import { Link, useSearch } from "wouter"
import { FeedCard } from "../components/feed_card"
import { Waiting } from "../components/loading"
import { client } from "../main"
import { ProfileContext } from "../state/profile"
import { headersWithAuth } from "../utils/auth"

function tryInt(defaultValue: number, ...args: (string | number | undefined | null)[]): number {
    for (const v of args) {
        if (typeof v === "number") return v
        if (typeof v === "string") {
            const n = parseInt(v)
            if (!isNaN(n)) return n
        }
    }
    return defaultValue
}

type FeedsData = {
    size: number,
    data: any[],
    hasNext: boolean
}

type FeedType = 'draft' | 'unlisted' | 'normal'

type FeedsMap = {
    [key in FeedType]: FeedsData
}

export function FeedsPage() {
    const query = new URLSearchParams(useSearch());
    const profile = useContext(ProfileContext);
    const [listState, _setListState] = useState<FeedType>('normal')
    function setListState(type: FeedType) {
        if (feeds[type].size === 0) fetchFeeds(type)
        _setListState(type)
    }
    const [feeds, setFeeds] = useState<FeedsMap>({
        draft: { size: 0, data: [], hasNext: false },
        unlisted: { size: 0, data: [], hasNext: false },
        normal: { size: 0, data: [], hasNext: false }
    })
    const page = tryInt(1, query.get("page"))
    const limit = tryInt(10, query.get("limit"), process.env.PAGE_SIZE)
    const ref = useRef(false)
    function fetchFeeds(type: FeedType) {
        client.feed.index.get({
            query: {
                page: page,
                limit: limit,
                type: type
            },
            headers: headersWithAuth()
        }).then(({ data }) => {
            if (data && typeof data != 'string') {
                setFeeds({
                    ...feeds,
                    [type]: data
                })
            }
        })
    }
    useEffect(() => {
        if (ref.current) return
        fetchFeeds(listState)
        ref.current = true
    }, [])

    useEffect(() => {
        if (feeds) {
            fetchFeeds(listState)
        }
    }, [query.get("page")])
    return (
        <>
            <Waiting wait={feeds}>
                <div className="w-full flex flex-col justify-center items-center mb-8">
                    <div className="wauto text-start text-black dark:text-white p-4 text-4xl font-bold">
                        <p>
                            {listState === 'draft' ? "草稿箱" : listState === 'normal' ? "文章" : "未列出"}
                        </p>
                        <div className="flex flex-row justify-between">
                            <p className="text-sm mt-4 text-neutral-500 font-normal">
                                共有 {feeds[listState]?.size} 篇文章
                            </p>
                            {profile?.permission &&
                                <div className="flex flex-row space-x-4">
                                    <button onClick={() => listState === 'draft' ? setListState('normal') : setListState('draft')} className={`text-sm mt-4 text-neutral-500 font-normal ${listState === 'draft' ? "text-theme" : ""}`}>
                                        草稿箱
                                    </button>
                                    <button onClick={() => listState === 'unlisted' ? setListState('normal') : setListState('unlisted')} className={`text-sm mt-4 text-neutral-500 font-normal ${listState === 'unlisted' ? "text-theme" : ""}`}>
                                        未列出
                                    </button>
                                </div>
                            }
                        </div>
                    </div>
                    {feeds[listState].data.map(({ id, ...feed }: any) => (
                        <FeedCard key={id} id={id} {...feed} />
                    ))}
                    <div className="wauto flex justify-between items-center">
                        <Link href={"/?page=" + (page - 1)}
                            className={`text-sm mt-4 font-normal rounded-full px-4 py-2 text-white bg-theme  ${page > 1 ? '' : 'invisible'}`}>
                            上一页
                        </Link>
                        <Link href={"/?page=" + (page + 1)}
                            className={`text-sm mt-4 font-normal rounded-full px-4 py-2 text-white bg-theme ${feeds[listState]?.hasNext ? '' : 'invisible'}`}>
                            下一页
                        </Link>
                    </div>
                </div>
            </Waiting>
        </>
    )
}

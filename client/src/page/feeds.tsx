import { useContext, useEffect, useRef, useState } from "react"
import { FeedCard } from "../components/feed_card"
import { Header } from "../components/header"
import { Waiting } from "../components/loading"
import { Padding } from "../components/padding"
import { client } from "../main"
import { ProfileContext } from "../state/profile"
import { headersWithAuth } from "../utils/auth"

export function FeedsPage() {
    return (<>
        <Header />
        <Padding>
            <Feeds />
        </Padding>
    </>)
}

function Feeds() {
    const profile = useContext(ProfileContext);
    const [listState, setListState] = useState<'draft' | 'unlisted' | 'normal'>('normal')
    const [feeds, setFeeds] = useState<any>()
    const ref = useRef(false)
    useEffect(() => {
        if (ref.current) return
        client.feed.index.get({
            headers: headersWithAuth()
        }).then(({ data }) => {
            if (data)
                setFeeds(data)
        })
        ref.current = true
    }, [])
    const feed_filtered = feeds?.filter(
        ({ draft, listed }: { draft: number | undefined, listed: number | undefined }) =>
            listState === 'draft' ? draft === 1 : listState === 'unlisted' ? listed === 0 : draft != 1 && listed != 0)
    return (
        <>
            <Waiting wait={feed_filtered}>
                <div className="w-full flex flex-col justify-center items-center mb-8">
                    <div className="wauto text-start text-black dark:text-white p-4 text-4xl font-bold">
                        <p>
                            {listState === 'draft' ? "草稿箱" : listState === 'normal' ? "文章" : "未列出"}
                        </p>
                        <div className="flex flex-row justify-between">
                            <p className="text-sm mt-4 text-neutral-500 font-normal">
                                共有 {feed_filtered?.length} 篇文章
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
                    {feed_filtered && feed_filtered.map(({ id, ...feed }: any) => (
                        <FeedCard key={id} id={id} {...feed} />
                    ))}
                </div>
            </Waiting>
        </>
    )
}
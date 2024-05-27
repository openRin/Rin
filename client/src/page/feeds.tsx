import { useContext, useEffect, useRef, useState } from "react"
import { FeedCard } from "../components/feed_card"
import { Header } from "../components/header"
import { client } from "../main"
import { Padding } from "../components/padding"
import { headersWithAuth } from "../utils/auth"
import { ProfileContext } from "../state/profile"

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
    const [onlyDraft, setDraft] = useState<boolean>(false)
    const [enableListed, setListed] = useState<boolean>(false)
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
            (draft === 1) === onlyDraft && (onlyDraft || (listed === 1) != enableListed))
    return (
        <>
            <div className="w-full flex flex-col justify-center items-center">
                <div className="wauto text-start text-black p-4 text-4xl font-bold">
                    <p>
                        {onlyDraft ? "草稿箱" : "文章"}
                    </p>
                    <div className="flex flex-row justify-between">
                        <p className="text-sm mt-4 text-neutral-500 font-normal">
                            共有 {feed_filtered?.length} 篇文章
                        </p>
                        {profile?.permission &&
                            <div className="flex flex-row space-x-4">
                                <button onClick={() => setDraft(!onlyDraft)} className={`text-sm mt-4 text-neutral-500 font-normal ${onlyDraft ? "text-theme" : ""}`}>
                                    草稿箱
                                </button>
                                <button onClick={() => setListed(!enableListed)} className={`text-sm mt-4 text-neutral-500 font-normal ${enableListed ? "text-theme" : ""}`}>
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
        </>
    )
}
import { useEffect, useState } from "react"
import { FeedCard } from "../components/feed_card"
import { client } from "../main"

export function Feeds() {
    let [feeds, setFeeds] = useState<any>()
    useEffect(() => {
        client.feed.index.get().then(({ data }) => {
            if (data)
                setFeeds(data)
        })
    }, [])
    return (
        <>
            <div className="w-full flex flex-col justify-center items-center">
                <div className="w-1/2 text-start text-black p-4 text-4xl font-bold">
                    <p>
                        文章
                    </p>
                    <p className="text-sm mt-4 text-neutral-500 font-normal">
                        共有 {feeds?.length} 篇文章
                    </p>
                </div>
                {feeds?.map(({ id, ...feed }: any) => (
                    <FeedCard key={id} {...feed} />
                ))}
            </div>
        </>
    )
}
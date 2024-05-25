import { useEffect, useRef, useState } from "react"
import { FeedCard } from "../components/feed_card"
import { Header } from "../components/header"
import { client } from "../main"
import { Padding } from "../components/padding"

export function FeedsPage() {
    return (<>
        <Header />
        <Padding>
            <Feeds />
        </Padding>
    </>)
}

function Feeds() {
    let [feeds, setFeeds] = useState<any>()
    const ref = useRef(false)
    useEffect(() => {
        if (ref.current) return
        client.feed.index.get().then(({ data }) => {
            if (data)
                setFeeds(data)
        })
        ref.current = true
    }, [])
    return (
        <>
            <div className="w-full flex flex-col justify-center items-center">
                <div className="wauto text-start text-black p-4 text-4xl font-bold">
                    <p>
                        文章
                    </p>
                    <p className="text-sm mt-4 text-neutral-500 font-normal">
                        共有 {feeds?.length} 篇文章
                    </p>
                </div>
                {feeds?.map(({ id, ...feed }: any) => (
                    <FeedCard key={id} id={id} {...feed} />
                ))}
            </div>
        </>
    )
}
import { useEffect, useState } from "react"
import { client } from "../main"
import { MilkdownProvider } from "@milkdown/react";
import { ProsemirrorAdapterProvider } from "@prosemirror-adapter/react";
import { MilkdownEditor } from "./editor/editor";

type Feed = {
    id: number;
    title: string | null;
    content: string;
    uid: number;
    createdAt: Date;
    updatedAt: Date;
    hashtags: {
        id: number;
        name: string;
    }[];
    user: {
        avatar: string | null;
        id: number;
        username: string;
    };
}

export function FeedPage({ id }: { id: string }) {
    const [feed, setFeed] = useState<Feed>()
    useEffect(() => {
        // fetch feed detail
        client.feed({ id }).get().then(({ data }) => {
            console.log(data)
            if (data && typeof data !== 'string') {
                if (data.createdAt) {
                    data.createdAt = new Date(data.createdAt)
                }
                if (data.updatedAt) {
                    data.updatedAt = new Date(data.updatedAt)
                }
                setFeed(data)
            }
        })
    }, [])
    return (
        <>
            <div className="w-full flex flex-col justify-center items-center">
                {feed &&
                    <div className="w-1/2 rounded-2xl bg-white m-2 p-6">
                        <h1 className="text-xl font-bold text-gray-700">
                            {feed.title}
                        </h1>
                        <div className="my-2">
                            <span className="text-gray-400 text-sm" title={new Date(feed.createdAt).toLocaleString()}>
                                {feed.createdAt === feed.updatedAt ? '发布于' : '更新于'} {new Date(feed.createdAt).toLocaleString()}
                            </span>
                        </div>
                        <div className='flex flex-row justify-start mt-8'>
                            <MilkdownProvider>
                                <ProsemirrorAdapterProvider>
                                    <MilkdownEditor data={feed.content} readonly={true} />
                                </ProsemirrorAdapterProvider>
                            </MilkdownProvider>
                        </div>
                        {feed.hashtags.length > 0 &&
                            <div className="mt-2 flex flex-row">
                                {feed.hashtags.map(({ name }, index) => (
                                    <div key={index} className="bg-neutral-100 py-1 px-2 m-1 rounded-lg">
                                        {name}
                                    </div>
                                ))}
                            </div>
                        }
                        <div className="mt-2 flex flex-row items-center">
                            <img src={feed.user.avatar || '/avatar.png'} className="w-8 h-8 rounded-full" />
                            <div className="ml-2">
                                <span className="text-gray-400 text-sm">
                                    {feed.user.username}
                                </span>
                            </div>
                        </div>
                    </div>
                }
            </div>
        </>
    )
}
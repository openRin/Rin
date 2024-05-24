import { format } from "@astroimg/timeago";
import { MilkdownProvider } from "@milkdown/react";
import { ProsemirrorAdapterProvider } from "@prosemirror-adapter/react";
import { useContext, useEffect, useRef, useState } from "react";
import { Icon } from "../components/icon";
import { client } from "../main";
import { ProfileContext } from "../state/profile";
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
    const profile = useContext(ProfileContext);
    const [feed, setFeed] = useState<Feed>()
    const ref = useRef(false)
    useEffect(() => {
        if (ref.current) return
        client.feed({ id }).get().then(({ data }) => {
            if (data && typeof data !== 'string') {
                setFeed(data)
            }
        })
        ref.current = true
    }, [])
    return (
        <>
            <div className="w-full flex flex-col justify-center items-center">
                {feed &&
                    <div className="w-1/2 rounded-2xl bg-white m-2 p-6">
                        <div className="flex flex-row items-center">
                            <h1 className="text-xl font-bold text-gray-700">
                                {feed.title}
                            </h1>
                            {profile?.permission && <div className="flex-1 flex flex-col items-end justify-center">
                                <Icon name="ri-edit-2-line ri-lg" onClick={() => window.location.href = `/writing/${id}`} />
                            </div>}
                        </div>
                        <div className="my-2">
                            <p className="text-gray-400 text-sm" title={new Date(feed.createdAt).toLocaleString()}>
                                发布于 {format(feed.createdAt)}
                            </p>
                            {feed.createdAt !== feed.updatedAt &&
                                <p className="text-gray-400 text-sm" title={new Date(feed.updatedAt).toLocaleString()}>
                                    更新于 {format(feed.updatedAt)}
                                </p>
                            }
                        </div>
                        <MilkdownProvider>
                            <ProsemirrorAdapterProvider>
                                <MilkdownEditor data={feed.content} readonly={true} />
                            </ProsemirrorAdapterProvider>
                        </MilkdownProvider>
                        {feed.hashtags.length > 0 &&
                            <div className="mt-2 flex flex-row space-x-2">
                                {feed.hashtags.map(({ name }, index) => (
                                    <div key={index} className="bg-neutral-100 py-1 px-2 rounded-lg">
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
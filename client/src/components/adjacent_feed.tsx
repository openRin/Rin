import {useEffect, useState} from "react";
import {client} from "../main.tsx";
import {timeago} from "../utils/timeago.ts";
import {Link} from "wouter";
import {useTranslation} from "react-i18next";

export type AdjacentFeed = {
    id: number;
    title: string | null;
    summary?: string;
    hashtags?: {
        id: number;
        name: string;
    }[];
    createdAt: Date | string;
    updatedAt: Date | string;
};
export type AdjacentFeeds = {
    nextFeed: AdjacentFeed | null;
    previousFeed: AdjacentFeed | null;
};

export function AdjacentSection({id, setError}: { id: string, setError: (error: string) => void }) {
    const [adjacentFeeds, setAdjacentFeeds] = useState<AdjacentFeeds>();

    useEffect(() => {
        client.feed
            .adjacent(id)
            .then(({data, error}) => {
                if (error) {
                    setError(error.value as string);
                } else if (data) {
                    setAdjacentFeeds({
                        nextFeed: data.next,
                        previousFeed: data.prev
                    });
                }
            });
    }, [id, setError]);
    return (
        <div className="rounded-2xl bg-w m-2 grid grid-cols-1 sm:grid-cols-2">
            <AdjacentCard data={adjacentFeeds?.previousFeed} type="previous"/>
            <AdjacentCard data={adjacentFeeds?.nextFeed} type="next"/>
        </div>
    )
}

export function AdjacentCard({data, type}: { data: AdjacentFeed | null | undefined, type: "previous" | "next" }) {
    const direction = type === "previous" ? "text-start" : "text-end"
    const radius = type === "previous" ? "rounded-t-2xl sm:rounded-none sm:rounded-l-2xl" : "rounded-b-2xl sm:rounded-none sm:rounded-r-2xl"
    const {t} = useTranslation()
    if (!data) {
        return (<div className="w-full p-6 duration-300">
            <p className={`t-secondary w-full ${direction}`}>
                {type === "previous" ? "Previous" : "Next"}
            </p>
            <h1 className={`text-xl text-gray-700 dark:text-white text-pretty truncate ${direction}`}>
                {t('no_more')}
            </h1>
        </div>);
    }
    return (
        <Link href={`/feed/${data.id}`} target="_blank"
              className={`w-full p-6 duration-300 bg-button ${radius}`}>
            <p className={`t-secondary w-full ${direction}`}>
                {type === "previous" ? "Previous" : "Next"}
            </p>
            <h1 className={`text-xl font-bold text-gray-700 dark:text-white text-pretty truncate ${direction}`}>
                {data.title}
            </h1>
            <p className={`space-x-2 ${direction}`}>
                <span className="text-gray-400 text-sm" title={new Date(data.createdAt).toLocaleString()}>
                    {data.createdAt === data.updatedAt ? timeago(data.createdAt) : t('feed_card.published$time', {time: timeago(data.createdAt)})}
                </span>
                {data.createdAt !== data.updatedAt &&
                    <span className="text-gray-400 text-sm" title={new Date(data.updatedAt).toLocaleString()}>
                        {t('feed_card.updated$time', {time: timeago(data.updatedAt)})}
                    </span>
                }
            </p>
        </Link>
    )
}
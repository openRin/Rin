import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { timeago } from "../utils/timeago";
import { HashTag } from "./hashtag";
import { useMemo } from "react";
export function FeedCard({ id, title, avatar, draft, listed, top, summary, hashtags, createdAt, updatedAt }:
    {
        id: string, avatar?: string,
        draft?: number, listed?: number, top?: number,
        title: string, summary: string,
        hashtags: { id: number, name: string }[],
        createdAt: Date, updatedAt: Date
    }) {
    const { t } = useTranslation()
    return useMemo(() => (
        <>
            <Link href={`/feed/${id}`} target="_blank" className="w-full rounded-2xl bg-w my-2 p-6 duration-300 bg-button">
                {avatar &&
                    <div className="flex flex-row items-center mb-2 rounded-xl overflow-clip">
                        <img src={avatar} alt=""
                            className="object-cover object-center w-full max-h-96 hover:scale-105 translation duration-300" />
                    </div>}
                <h1 className="text-xl font-bold text-gray-700 dark:text-white text-pretty overflow-hidden">
                    {title}
                </h1>
                <p className="space-x-2">
                    <span className="text-gray-400 text-sm" title={new Date(createdAt).toLocaleString()}>
                        {createdAt === updatedAt ? timeago(createdAt) : t('feed_card.published$time', { time: timeago(createdAt) })}
                    </span>
                    {createdAt !== updatedAt &&
                        <span className="text-gray-400 text-sm" title={new Date(updatedAt).toLocaleString()}>
                            {t('feed_card.updated$time', { time: timeago(updatedAt) })}
                        </span>
                    }
                </p>
                <p className="space-x-2">
                    {draft === 1 && <span className="text-gray-400 text-sm">草稿</span>}
                    {listed === 0 && <span className="text-gray-400 text-sm">未列出</span>}
                    {top === 1 && <span className="text-theme text-sm">
                        置顶
                    </span>}
                </p>
                <p className="text-pretty overflow-hidden dark:text-neutral-500">
                    {summary}
                </p>
                {hashtags.length > 0 &&
                    <div className="mt-2 flex flex-row flex-wrap justify-start gap-x-2">
                        {hashtags.map(({ name }, index) => (
                            <HashTag key={index} name={name} />
                        ))}
                    </div>
                }

            </Link>
        </>
    ), [id, title, avatar, draft, listed, top, summary, hashtags, createdAt, updatedAt])
}
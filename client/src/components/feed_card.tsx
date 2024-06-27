import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { timeago } from "../utils/timeago";
export function FeedCard({ id, title, avatar, draft, listed, summary, hashtags, createdAt, updatedAt }: { id: string, avatar?: string, draft?: number, listed?: number, title: string, summary: string, hashtags: { id: number, name: string }[], createdAt: Date, updatedAt: Date }) {
    const { t } = useTranslation()
    return (
        <>
            <Link href={`/feed/${id}`} target="_blank" className="wauto rounded-2xl bg-w bg-hover m-2 p-6 duration-300 ani-show">
                {avatar &&
                    <div className="flex flex-row items-center mb-2">
                        <img src={avatar} alt=""
                            className="object-cover object-center w-full max-h-96 rounded-xl" />
                    </div>}
                <h1 className="text-xl font-bold text-gray-700 dark:text-white text-pretty overflow-hidden">
                    {title}
                </h1>
                <div className="space-x-2">
                    <span className="text-gray-400 text-sm" title={new Date(createdAt).toLocaleString()}>
                        {createdAt === updatedAt ? timeago(createdAt) : t('feed_card.published$time', { time: timeago(createdAt) })}
                    </span>
                    {createdAt !== updatedAt &&
                        <span className="text-gray-400 text-sm" title={new Date(updatedAt).toLocaleString()}>
                            {t('feed_card.updated$time', { time: timeago(updatedAt) })}
                        </span>
                    }
                    {draft === 1 && <span className="text-gray-400 text-sm">草稿</span>}
                    {listed === 0 && <span className="text-gray-400 text-sm">未列出</span>}
                </div>
                <p className="text-pretty overflow-hidden dark:text-neutral-500">
                    {summary}
                </p>
                {hashtags.length > 0 &&
                    <div className="mt-2 flex flex-row">
                        {hashtags.map(({ name }, index) => (
                            <div key={index} className="bg-neutral-100 dark:bg-neutral-600 dark:text-neutral-300 py-1 px-2 m-1 rounded-lg">
                                {name}
                            </div>
                        ))}
                    </div>
                }

            </Link>
        </>
    )
}
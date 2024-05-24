import { format } from "@astroimg/timeago";
import { useLocation } from "wouter";

export function FeedCard({ id, title, content, hashtags, createdAt, updatedAt }: { id: string, title: string, content: string, hashtags: { id: number, name: string }[], createdAt: Date, updatedAt: Date }) {
    const [_, setLocation] = useLocation();
    return (
        <>
            <div onClick={() => setLocation(`/feed/${id}`)} className="w-1/2 rounded-2xl bg-white m-2 p-6 hover:bg-neutral-200 duration-300">
                <h1 className="text-xl font-bold text-gray-700">
                    {title}
                </h1>
                <div>
                    <span className="text-gray-400 text-sm" title={new Date(createdAt).toLocaleString()}>
                        {format(createdAt) + (createdAt === updatedAt ? '' : '发布 ' + format(updatedAt) + "更新")}
                    </span>
                </div>
                <p>
                    {content}
                </p>
                {hashtags.length > 0 &&
                    <div className="mt-2 flex flex-row">
                        {hashtags.map(({ name }, index) => (
                            <div key={index} className="bg-neutral-100 py-1 px-2 m-1 rounded-lg">
                                {name}
                            </div>
                        ))}
                    </div>
                }

            </div>
        </>
    )
}
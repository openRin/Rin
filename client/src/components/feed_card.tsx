import { format } from "@astroimg/timeago";

export function FeedCard({ title, content, hashtags, createdAt, updatedAt }: { title: string, content: string, hashtags: { id: number, name: string }[], createdAt: Date, updatedAt: Date }) {
    return (
        <>
            <div className="w-1/2 rounded-2xl bg-white m-2 p-6 hover:bg-neutral-200 duration-300">
                <h1 className="text-xl font-bold text-gray-700">
                    {title}
                </h1>
                <div>
                    <span className="text-gray-400 text-sm" title={new Date(createdAt).toLocaleString()}>
                        {format(createdAt) + (createdAt === updatedAt ? '' : '更新于' + format(updatedAt))}
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
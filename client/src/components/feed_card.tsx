import { format } from "@astroimg/timeago";

export function FeedCard({ title, content, hashtags, createdAt, updatedAt }: { title: string, content: string, hashtags: string[], createdAt: Date, updatedAt: Date }) {
    return (
        <>
            <div className="w-1/2 rounded-md bg-white m-2 p-6 hover:bg-neutral-200 duration-300">
                <h1 className="text-2xl font-bold text-gray-700">
                    {title}
                </h1>
                <div>
                    <span className="text-gray-400 text-sm">
                        {format(createdAt)}
                    </span>
                </div>
                <p>
                    {content}
                </p>
                <div>
                    {hashtags.map((tag, index) => (
                        <span key={index} className="bg-gray-200 p-1 m-1 rounded-lg">
                            {tag}
                        </span>
                    ))}
                </div>

            </div>
        </>
    )
}
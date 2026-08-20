import { useTranslation } from "react-i18next";
import { Markdown } from "./markdown";
import { timeago } from "../utils/timeago";
import { ImageWithFallback } from "./image-with-fallback";

interface Moment {
    id: number;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    user: {
        id: number;
        username: string;
        avatar: string;
    };
}

export function MomentItem({ 
    moment, 
    onDelete,
    onEdit,
    canManage
}: { 
    moment: Moment, 
    onDelete: (id: number) => void,
    onEdit: (moment: Moment) => void,
    canManage: boolean
}) {
    const { t } = useTranslation()
    const { createdAt, updatedAt } = moment;
    
    return (
        <div className="min-w-0 rounded-lg bg-w p-4">
            <div className="flex min-w-0 justify-between gap-3">
                <div className="flex min-w-0 items-center space-x-3">
                    <ImageWithFallback
                        src={moment.user.avatar}
                        alt={moment.user.username}
                        className="h-8 w-8 rounded-full"
                    />
                    <div className="min-w-0">
                        <p className="truncate t-primary">
                            {moment.user.username}
                        </p>
                        <p className="space-x-2 t-secondary text-sm"> 
                            <span title={new Date(createdAt).toLocaleString()}> 
                                {createdAt === updatedAt ? timeago(createdAt) : t('feed_card.published$time', { time: timeago(createdAt) })} 
                            </span> 
                            {createdAt !== updatedAt && 
                                <span title={new Date(updatedAt).toLocaleString()}> 
                                    {t('feed_card.updated$time', { time: timeago(updatedAt) })} 
                                </span> 
                            } 
                        </p>
                    </div>
                </div>
                {canManage && (
                    <div className="shrink-0">
                        <div className="flex gap-2">
                            <button
                                aria-label={t("edit")}
                                onClick={() => onEdit(moment)}
                                className="flex-1 flex flex-col items-end justify-center px-2 py bg-secondary bg-button rounded-full transition"
                            >
                                <i className="ri-edit-2-line dark:text-neutral-400" />
                            </button>
                            <button
                                aria-label={t("delete.title")}
                                onClick={() => onDelete(moment.id)}
                                className="flex-1 flex flex-col items-end justify-center px-2 py bg-secondary bg-button rounded-full transition"
                            >
                                <i className="ri-delete-bin-7-line text-red-500" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <div className="text-black dark:text-white mt-2">
                <Markdown content={moment.content} />
            </div>
        </div>
    )
}

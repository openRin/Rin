import { useTranslation } from "react-i18next";
import { Markdown } from "./markdown";
import { timeago } from "../utils/timeago";

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
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="flex justify-between">
                <div className="flex items-center space-x-3">
                    <img 
                        src={moment.user.avatar} 
                        alt={moment.user.username} 
                        className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                        <div className="font-medium text-black dark:text-white">
                            {moment.user.username}
                        </div>
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
                    </div>
                </div>
                {canManage && (
                    <div className="flex gap-2 pb-10">
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
                )}
            </div>
            <div className="text-black dark:text-white mt-2">
                <Markdown content={moment.content} />
            </div>
        </div>
    )
}
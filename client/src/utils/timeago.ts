import { format } from "@astroimg/timeago";
import i18n from "i18next"

export function timeago(time: string | number | Date) {
    const locale = i18n.language == 'zh' ? 'zh-CN' : 'en'
    return format(time, "DEFAULT", locale)
}
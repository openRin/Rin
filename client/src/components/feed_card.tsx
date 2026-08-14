import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { timeago } from "../utils/timeago";
import { HashTag } from "./hashtag";
import { useEffect, useRef } from "react";
import { drawBlurhashToCanvas } from "../utils/blurhash";
import { parseImageUrlMetadata } from "../utils/image-upload";
import { useImageLoadState } from "../utils/use-image-load-state";
import { type FeedCardVariant, normalizeFeedCardVariant } from "./feed-card-options";
import { useSiteConfig } from "../hooks/useSiteConfig";

const MIRAGES_GRADIENTS = [
    ["#EB3349", "#F45C43"],
    ["#DD5E89", "#F7BB97"],
    ["#4CB8C4", "#3CD3AD"],
    ["#A6FFCB", "#12D8FA", "#1FA2FF"],
    ["#FF512F", "#F09819"],
    ["#1A2980", "#26D0CE"],
    ["#F09819", "#EDDE5D"],
    ["#403B4A", "#E7E9BB"],
    ["#003973", "#E5E5BE"],
    ["#348F50", "#56B4D3"],
    ["#EDE574", "#E1F5C4"],
    ["#16A085", "#F4D03F"],
    ["#314755", "#26a0da"],
    ["#e65c00", "#F9D423"],
    ["#2193b0", "#6dd5ed"],
    ["#ec008c", "#fc6767"],
    ["#1488CC", "#2B32B2"],
    ["#ffe259", "#ffa751"],
    ["#11998e", "#38ef7d"],
    ["#00b09b", "#96c93d"],
    ["#3C3B3F", "#605C3C"],
    ["#fc4a1a", "#f7b733"],
];

function gradientForFeed(id: string | number): string {
    const numericId = typeof id === "number" ? id : parseInt(id, 10);
    const index = (isNaN(numericId) ? 0 : Math.abs(numericId)) % MIRAGES_GRADIENTS.length;
    const colors = MIRAGES_GRADIENTS[index];
    if (colors.length === 2) {
        return `linear-gradient(90deg, ${colors[0]}, ${colors[1]})`;
    }
    return `linear-gradient(90deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)`;
}

function FeedCardImage({ src, variant }: { src: string; variant: FeedCardVariant }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { src: cleanSrc, blurhash, width, height } = parseImageUrlMetadata(src);
    const { failed, imageRef, loaded, onError, onLoad } = useImageLoadState(cleanSrc);
    const aspectRatio = width && height ? `${width} / ${height}` : "16 / 9";
    const imageFrameClass =
        variant === "editorial"
            ? "relative flex max-h-80 w-full flex-row items-center overflow-hidden rounded-[20px]"
            : "relative mb-2 flex max-h-80 w-full flex-row items-center overflow-hidden rounded-xl";

    useEffect(() => {
        if (!blurhash || !canvasRef.current) {
            return;
        }
        try {
            drawBlurhashToCanvas(canvasRef.current, blurhash);
        } catch (error) {
            console.error("Failed to render blurhash", error);
        }
    }, [blurhash]);

    return (
        <div
            className={imageFrameClass}
            style={{ aspectRatio: aspectRatio || '16 / 9' }}
        >
            {blurhash && !loaded ? (
                <canvas
                    ref={canvasRef}
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full scale-110 object-cover blur-sm"
                />
            ) : null}
            <img
                ref={imageRef}
                src={cleanSrc}
                alt=""
                width={width}
                height={height}
                onLoad={onLoad}
                onError={onError}
                className={`absolute inset-0 h-full w-full object-cover object-center hover:scale-105 translation duration-300 ${blurhash && (!loaded || failed) ? "opacity-0" : "opacity-100"
                    }`}
            />
        </div>
    );
}

const FEED_CARD_STYLES: Record<
    FeedCardVariant,
    {
        card: string;
        imageWrap: string;
        meta: string;
        summary: string;
        title: string;
    }
> = {
    default: {
        card: "my-2 inline-block w-full break-inside-avoid rounded-2xl bg-w p-6 duration-300 bg-button",
        imageWrap: "",
        meta: "text-gray-400 text-sm",
        summary: "line-clamp-4 text-pretty overflow-hidden dark:text-neutral-500",
        title: "text-xl font-bold text-gray-700 dark:text-white text-pretty overflow-hidden",
    },
    editorial: {
        card: "my-3 inline-block w-full break-inside-avoid overflow-hidden rounded-[28px] border border-black/10 bg-w p-3 shadow-[0_24px_60px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_28px_70px_rgba(15,23,42,0.12)] dark:border-white/10",
        imageWrap: "mb-3 overflow-hidden rounded-[22px] border border-black/5 dark:border-white/10",
        meta: "text-[12px] font-medium uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400",
        summary: "line-clamp-5 text-pretty text-[15px] leading-7 text-neutral-600 dark:text-neutral-300",
        title: "text-2xl font-semibold tracking-[-0.02em] text-neutral-900 dark:text-white text-pretty overflow-hidden",
    },
    mirages: {
        card: "my-4 inline-block w-full break-inside-avoid overflow-hidden rounded-[5px] md:my-[32px_0_20px]",
        imageWrap: "",
        meta: "text-[13px] font-normal text-[#eee]",
        summary: "",
        title: "text-[25px] font-normal text-white",
    },
};

export type FeedCardProps = {
    id: string;
    avatar?: string;
    draft?: number;
    listed?: number;
    top?: number;
    title: string;
    summary: string;
    hashtags?: { id: number, name: string }[];
    createdAt: Date;
    updatedAt: Date;
    preview?: boolean;
    variant?: FeedCardVariant;
};

function MiragesCardBody({ id, title, avatar, draft, listed, top, hashtags, createdAt, updatedAt }: Omit<FeedCardProps, "preview" | "variant" | "summary">) {
    const { t } = useTranslation();
    const safeHashtags = Array.isArray(hashtags) ? hashtags : [];
    const background = avatar ? undefined : gradientForFeed(id);
    const { src: cleanSrc, blurhash, width, height } = parseImageUrlMetadata(avatar || "");
    const { failed, imageRef, loaded, onError, onLoad } = useImageLoadState(cleanSrc);

    useEffect(() => {
        if (!blurhash || !cleanSrc) {
            return;
        }
        try {
            const canvas = document.createElement("canvas");
            drawBlurhashToCanvas(canvas, blurhash);
        } catch (error) {
            console.error("Failed to render blurhash", error);
        }
    }, [blurhash, cleanSrc]);

    return (
        <div
            className="relative mb-5 mt-4 h-[200px] w-full overflow-hidden rounded-[5px] shadow-[0_1px_1px_rgba(0,0,0,0.1)] transition-all duration-300 hover:-translate-y-1 hover:scale-[1.05] hover:shadow-[0_22px_43px_rgba(0,0,0,0.15)] md:mb-[20px] md:mt-[32px] md:h-[248px]"
            style={background ? { background } : undefined}
        >
            {avatar ? (
                <>
                    {blurhash && !loaded ? (
                        <div className="absolute inset-0 scale-110 bg-cover blur-sm" />
                    ) : null}
                    <img
                        ref={imageRef}
                        src={cleanSrc}
                        alt=""
                        width={width}
                        height={height}
                        onLoad={onLoad}
                        onError={onError}
                        className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300 ${blurhash && (!loaded || failed) ? "opacity-0" : "opacity-100"}`}
                    />
                </>
            ) : null}
            <div className="absolute inset-0 bg-black/25 transition-colors duration-300 hover:bg-black/40" />
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="px-8 text-center">
                    <h2 className="mb-3 text-[25px] font-normal leading-snug text-white text-pretty">{title}</h2>
                    <div className="flex items-center justify-center gap-2 text-[13px] font-normal text-[#eee]">
                        <span title={new Date(createdAt).toLocaleString()}>
                            {createdAt === updatedAt ? timeago(createdAt) : t('feed_card.published$time', { time: timeago(createdAt) })}
                        </span>
                        {draft === 1 && <span>{t("draft")}</span>}
                        {listed === 0 && <span>{t("unlisted")}</span>}
                        {top === 1 && <span>{t('article.top.title')}</span>}
                        {safeHashtags.length > 0 && (
                            <span className="hidden md:inline">
                                {safeHashtags.slice(0, 3).map(({ name }) => `#${name}`).join(" ")}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function FeedCard({ id, title, avatar, draft, listed, top, summary, hashtags, createdAt, updatedAt, preview = false, variant }: FeedCardProps) {
    const { t } = useTranslation();
    const siteConfig = useSiteConfig();
    const safeHashtags = Array.isArray(hashtags) ? hashtags : [];
    const activeVariant = normalizeFeedCardVariant(variant ?? siteConfig.feedCardVariant);
    const styles = FEED_CARD_STYLES[activeVariant];
    const body = activeVariant === "mirages" ? (
        <MiragesCardBody id={id} title={title} avatar={avatar} draft={draft} listed={listed} top={top} hashtags={safeHashtags} createdAt={createdAt} updatedAt={updatedAt} />
    ) : (
        <div className={styles.card}>
            {avatar ? (
                <div className={styles.imageWrap}>
                    <FeedCardImage src={avatar} variant={activeVariant} />
                </div>
            ) : null}
            <div className={activeVariant === "editorial" ? "px-2 pb-2" : ""}>
                <h1 className={styles.title}>{title}</h1>
                <p className={`space-x-2 ${styles.meta}`}>
                    <span title={new Date(createdAt).toLocaleString()}>
                        {createdAt === updatedAt ? timeago(createdAt) : t('feed_card.published$time', { time: timeago(createdAt) })}
                    </span>
                    {createdAt !== updatedAt &&
                        <span title={new Date(updatedAt).toLocaleString()}>
                            {t('feed_card.updated$time', { time: timeago(updatedAt) })}
                        </span>
                    }
                </p>
                <p className={`space-x-2 ${styles.meta} ${activeVariant === "editorial" ? "mt-2" : ""}`}>
                    {draft === 1 && <span>{t("draft")}</span>}
                    {listed === 0 && <span>{t("unlisted")}</span>}
                    {top === 1 && <span className="text-theme">{t('article.top.title')}</span>}
                </p>
                <p className={`whitespace-pre-line ${styles.summary} ${activeVariant === "editorial" ? "mt-4 max-w-3xl" : ""}`}>{summary}</p>
                {safeHashtags.length > 0 &&
                    <div className={`flex flex-row flex-wrap justify-start gap-2 ${activeVariant === "editorial" ? "mt-4" : "mt-2 gap-x-2"}`}>
                        {safeHashtags.map(({ name }, index) => (
                            <HashTag key={index} name={name} />
                        ))}
                    </div>
                }
            </div>
        </div>
    );

    return preview ? body : <Link href={`/feed/${id}`} target="_blank" className="block w-full">{body}</Link>;
}

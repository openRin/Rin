import { useEffect, useRef, useState } from "react";
import { Helmet } from 'react-helmet';
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { HashTag } from "../components/hashtag";
import { Waiting } from "../components/loading";
import { client } from "../app/runtime";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants";

type Hashtag = {
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    feeds: number;
}

export function HashtagsPage() {
    const { t } = useTranslation();
    const siteConfig = useSiteConfig();
    const [hashtags, setHashtags] = useState<Hashtag[]>();
    const [sortBy, setSortBy] = useState<'latest' | 'popular'>('latest');
    const ref = useRef(false);

    useEffect(() => {
        if (ref.current) return;
        client.tag.list().then(({ data }) => {
            if (data) {
                setHashtags(data as any);
            }
        });
        ref.current = true;
    }, []);

    const sortedHashtags = hashtags
        ?.filter(({ feeds }) => feeds > 0)
        .sort((a, b) => {
            if (sortBy === 'popular') {
                if (b.feeds !== a.feeds) {
                    return b.feeds - a.feeds;
                }
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            } else {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
        });

    return (
        <>
            <Helmet>
                <title>{`${t('hashtags')} - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('hashtags')} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={hashtags}>
                <main className="w-full flex flex-col justify-center items-center mb-8 ani-show">
                    <div className="wauto text-start py-4 text-4xl font-bold">
                        <p className="text-black dark:text-white">
                            {t('hashtags')}
                        </p>
                        <div className="flex flex-row justify-between">
                            <p className="text-sm mt-4 text-neutral-500 font-normal">
                                {t('total_tags', { count: sortedHashtags?.length || 0 })}
                            </p>
                            <div className="flex flex-row items-center space-x-3">
                                <button
                                    onClick={() => setSortBy('latest')}
                                    className={`text-sm mt-4 text-neutral-500 font-normal transition-colors hover:text-theme ${sortBy === 'latest' ? "text-theme" : ""}`}
                                >
                                    {t('sort_latest')}
                                </button>
                                <span className="text-sm mt-4 text-neutral-300 dark:text-neutral-700 font-normal">|</span>
                                <button
                                    onClick={() => setSortBy('popular')}
                                    className={`text-sm mt-4 text-neutral-500 font-normal transition-colors hover:text-theme ${sortBy === 'popular' ? "text-theme" : ""}`}
                                >
                                    {t('sort_popular')}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="wauto flex flex-col flex-wrap items-start justify-start mt-2">
                        {sortedHashtags?.map((hashtag, index) => {
                            return (
                                <div key={index} className="w-full flex flex-row">
                                    <div className="w-full rounded-2xl m-2 duration-300 flex flex-row items-center space-x-4">
                                        <Link href={`/hashtag/${hashtag.name}`} className="text-base t-primary hover:text-theme text-pretty overflow-hidden">
                                            <HashTag name={hashtag.name} />
                                        </Link>
                                        <div className="flex-1" />
                                        <span className="t-secondary text-sm">
                                            {t("article.total_short$count", { count: hashtag.feeds })}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </main>
            </Waiting>
        </>
    )
}
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { client } from "../../../app/runtime";
import { useSiteConfig } from "../../../hooks/useSiteConfig";

const STATIC_TITLES: Record<string, string> = {
  timeline: "时间轴",
  moments: "动态",
  friends: "朋友们",
  hashtags: "标签",
  login: "登录",
  profile: "个人中心",
  about: "关于",
  archives: "归档",
};

export function MiragesHero() {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const [location] = useLocation();
  const [feed, setFeed] = useState<{ title: string; createdAt: string; user?: { username?: string }; hashtags?: { name: string }[]; pv?: number } | null>(null);

  const isHome = location === "/";
  const isFeedRoute = location.startsWith("/feed/");
  const isTagRoute = location.startsWith("/hashtag/");
  const firstSegment = location.split("/")[1] || "";
  const staticTitle = STATIC_TITLES[firstSegment];
  const isArticlePage = isFeedRoute || (!isTagRoute && !staticTitle && firstSegment.length > 0 && firstSegment !== "admin" && firstSegment !== "callback" && firstSegment !== "user" && firstSegment !== "search" && firstSegment !== "login" && firstSegment !== "profile");

  useEffect(() => {
    setFeed(null);
    if (!isArticlePage) {
      return;
    }
    const id = isFeedRoute ? location.split("/")[2] : firstSegment;
    let cancelled = false;
    client.feed
      .get(id)
      .then(({ data }) => {
        if (!cancelled && data && typeof data !== "string") {
          setFeed({ title: data.title || "", createdAt: data.createdAt, user: data.user, hashtags: data.hashtags, pv: data.pv });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [location]);

  let title: string;
  if (isHome) {
    title = siteConfig.name;
  } else if (isFeedRoute) {
    title = feed?.title || "";
  } else if (isTagRoute) {
    title = decodeURIComponent(location.split("/")[2] || "");
  } else if (staticTitle) {
    title = staticTitle;
  } else {
    title = feed?.title || "";
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()} 年 ${String(d.getMonth() + 1).padStart(2, "0")} 月 ${String(d.getDate()).padStart(2, "0")} 日`;
  };

  const categoryName = feed?.hashtags?.[0]?.name || "";

  return (
    <div className="relative flex h-[338px] items-center justify-center overflow-hidden bg-[#1e1e1f] md:h-[445px]">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: isHome && siteConfig.avatar
            ? `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${siteConfig.avatar})`
            : "linear-gradient(135deg, #1e1e1f 0%, #2c2a2a 100%)",
        }}
      />
      <div className="relative z-10 px-6 text-center">
        <h1 className="text-[28px] font-normal text-white md:text-[40px]">{title}</h1>
        {isHome && siteConfig.description ? (
          <p className="mt-4 text-sm text-neutral-200 md:text-[15px]">{siteConfig.description}</p>
        ) : null}
        {isArticlePage && feed ? (
          <p className="mt-4 text-[13px] text-white/90 md:text-[13px]">
            {feed.user?.username ? `${feed.user.username} • ` : ""}
            {feed.createdAt ? `${formatDate(feed.createdAt)} • ` : ""}
            {feed.pv !== undefined ? `${t("count.pv")}: ${feed.pv} • ` : ""}
            {categoryName}
          </p>
        ) : null}
      </div>
    </div>
  );
}

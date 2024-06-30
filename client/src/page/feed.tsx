import { format } from "@astroimg/timeago";
import { useContext, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import ReactModal from "react-modal";
import Popup from "reactjs-popup";
import tocbot from "tocbot";
import { Link, useLocation } from "wouter";
import { Waiting } from "../components/loading";
import { client } from "../main";
import { ProfileContext } from "../state/profile";
import { headersWithAuth } from "../utils/auth";
import { siteName } from "../utils/constants";
import { Markdown } from "../components/markdown";
import { useTranslation } from "react-i18next";

type Feed = {
  id: number;
  title: string | null;
  content: string;
  uid: number;
  createdAt: Date;
  updatedAt: Date;
  hashtags: {
    id: number;
    name: string;
  }[];
  user: {
    avatar: string | null;
    id: number;
    username: string;
  };
};

export function FeedPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const profile = useContext(ProfileContext);
  const [feed, setFeed] = useState<Feed>();
  const [error, setError] = useState<string>();
  const [headImage, setHeadImage] = useState<string>();
  const ref = useRef("");
  const [_, setLocation] = useLocation();
  const [empty, setEmpty] = useState(true);
  function deleteFeed() {
    // Confirm
    if (!confirm(t("article.delete.confirm"))) return;
    if (!feed) return;
    client
      .feed({ id: feed.id })
      .delete(null, {
        headers: headersWithAuth(),
      })
      .then(({ error }) => {
        if (error) {
          alert(error.value);
        } else {
          alert(t("delete.success"));
          setLocation("/");
        }
      });
  }
  useEffect(() => {
    if (ref.current == id) return;
    tocbot.init({
      tocSelector: ".toc",
      contentSelector: ".toc-content",
      headingSelector: "h1, h2, h3, h4, h5, h6",
      collapseDepth: 2,
      headingLabelCallback(headingLabel) {
        setEmpty(false);
        return headingLabel;
      },
    });
    setFeed(undefined);
    setError(undefined);
    setHeadImage(undefined);
    client
      .feed({ id })
      .get({
        headers: headersWithAuth(),
      })
      .then(({ data, error }) => {
        if (error) {
          setError(error.value as string);
        } else if (data && typeof data !== "string") {
          setTimeout(() => {
            setFeed(data);
            // Extract head image
            const img_reg = /!\[.*?\]\((.*?)\)/;
            const img_match = img_reg.exec(data.content);
            if (img_match) {
              setHeadImage(img_match[1]);
            }
            setTimeout(() => {
              // Refresh toc
              tocbot.refresh();
            }, 0);
          }, 0);
        }
      });
    ref.current = id;
  }, [id]);
  return (
    <Waiting for={feed || error}>
      {feed && (
        <Helmet>
          <title>{`${feed.title ?? "Unnamed"} - ${process.env.NAME}`}</title>
          <meta property="og:site_name" content={siteName} />
          <meta property="og:title" content={feed.title ?? ""} />
          <meta property="og:image" content={headImage ?? process.env.AVATAR} />
          <meta property="og:type" content="article" />
          <meta property="og:url" content={document.URL} />
          <meta
            name="og:description"
            content={
              feed.content.length > 200
                ? feed.content.substring(0, 200)
                : feed.content
            }
          />
          <meta name="author" content={feed.user.username} />
          <meta
            name="keywords"
            content={feed.hashtags.map(({ name }) => name).join(", ")}
          />
          <meta
            name="description"
            content={
              feed.content.length > 200
                ? feed.content.substring(0, 200)
                : feed.content
            }
          />
        </Helmet>
      )}
      <div className="w-full flex flex-row justify-center ani-show">
        {error && (
          <>
            <div className="flex flex-col wauto rounded-2xl bg-w m-2 p-6 items-center justify-center">
              <h1 className="text-xl font-bold t-primary">{error}</h1>
              <button
                className="mt-2 bg-theme text-white px-4 py-2 rounded-full"
                onClick={() => (window.location.href = "/")}
              >
                {t("index.back")}
              </button>
            </div>
          </>
        )}
        {feed && !error && (
          <>
            <div className="xl:w-64" />
            <main className="wauto">
              <article
                className="rounded-2xl bg-w m-2 px-6 py-4"
                aria-label="正文"
              >
                <div className="flex justify-between">
                  <div>
                    <div className="mt-1 mb-1 flex gap-1">
                      <p
                        className="text-gray-400 text-[12px]"
                        title={new Date(feed.createdAt).toLocaleString()}
                      >
                        {t("feed_card.published$time", {
                          time: format(feed.createdAt),
                        })}
                      </p>

                      {feed.createdAt !== feed.updatedAt && (
                        <p
                          className="text-gray-400 text-[12px]"
                          title={new Date(feed.updatedAt).toLocaleString()}
                        >
                          {t("feed_card.updated$time", {
                            time: format(feed.updatedAt),
                          })}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-row items-center">
                      <h1 className="text-2xl font-bold t-primary">
                        {feed.title}
                      </h1>
                      <div className="flex-1 w-0" />
                    </div>
                  </div>
                  <div className="pt-2">
                    {profile?.permission && (
                      <div className="flex gap-2">
                        <Link
                          aria-label={t("edit")}
                          href={`/writing/${feed.id}`}
                          className="flex-1 flex flex-col items-end justify-center px-2 py bg-secondary hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-full transition"
                        >
                          <i className="ri-edit-2-line dark:text-gray-400" />
                        </Link>
                        <button
                          aria-label={t("delete.title")}
                          onClick={deleteFeed}
                          className="flex-1 flex flex-col items-end justify-center px-2 py bg-secondary hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-full transition"
                        >
                          <i className="ri-delete-bin-7-line text-red-500" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <Markdown content={feed.content} />
                <div className="mt-6 flex flex-col gap-2">
                  {feed.hashtags.length > 0 && (
                    <div className="flex flex-row gap-2">
                      {feed.hashtags.map(({ name }, index) => (
                        <div className="flex gap-0.5">
                          <div className="text-sm opacity-70 italic dark:text-gray-300">#</div>
                          <div key={index} className="text-sm opacity-70 dark:text-gray-300">
                            {name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-row items-center">
                    <img
                      src={feed.user.avatar || "/avatar.png"}
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="ml-2">
                      <span className="text-gray-400 text-sm cursor-default">
                        {feed.user.username}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
              {feed && <Comments id={id} />}
              <div className="h-16" />
            </main>
            <div className="w-80 hidden lg:block relative">
              <TOC empty={empty} />
            </div>
          </>
        )}
      </div>
    </Waiting>
  );
}

export function TOCHeader() {
  const [isOpened, setIsOpened] = useState(false);
  const [empty, setEmpty] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpened) {
      setTimeout(() => {
        tocbot.init({
          tocSelector: ".toc2",
          contentSelector: ".toc-content",
          headingSelector: "h1, h2, h3, h4, h5, h6",
          collapseDepth: 2,
          headingLabelCallback(headingLabel) {
            setEmpty(false);
            return headingLabel;
          },
        });
      }, 0);
    } else {
      tocbot.destroy();
    }

    return () => {
      if (isOpened) {
        tocbot.destroy();
      }
    };
  }, [isOpened]);

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setIsOpened(true)}
        className="w-10 h-10 rounded-full flex flex-row items-center justify-center"
      >
        <i className="ri-menu-2-fill t-primary ri-lg"></i>
      </button>
      <ReactModal
        isOpen={isOpened}
        style={{
          content: {
            top: "50%",
            left: "50%",
            right: "auto",
            bottom: "auto",
            marginRight: "-50%",
            transform: "translate(-50%, -50%)",
            padding: "0",
            border: "none",
            borderRadius: "16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            background: "white",
          },
          overlay: {
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 1000,
          },
        }}
        onRequestClose={() => setIsOpened(false)}
      >
        <div className="rounded-2xl bg-w py-4 px-4 fixed w-[80vw] sm:w-[60vw] lg:w-[40vw] overflow-clip relative t-primary">
          <h1 className="text-xl font-bold">{t("index.title")}</h1>
          {empty && (
            <p className="text-gray-400 text-sm mt-2">
              {t("index.empty.title")}
            </p>
          )}
          <div className="toc toc2 mt-2"></div>
        </div>
      </ReactModal>
    </div>
  );
}

export function TOC({ empty }: { empty: boolean }) {
  const { t } = useTranslation();
  useEffect(() => {
    tocbot.init({
      tocSelector: ".toc",
      contentSelector: ".toc-content",
      headingSelector: "h1, h2, h3, h4, h5, h6",
      collapseDepth: 2,
    });

    return () => {
      tocbot.destroy();
    };
  }, []);

  return (
    <div
      className={`ml-2 rounded-2xl bg-w py-4 px-4 fixed start-0 end-0 top-[5.5rem] sticky t-primary`}
    >
      <h1 className="text-xl font-bold">{t("index.title")}</h1>
      {empty && (
        <p className="text-gray-400 text-sm mt-2">{t("index.empty.title")}</p>
      )}
      <div className="toc mt-2"></div>
    </div>
  );
}

function CommentInput({
  id,
  onRefresh,
}: {
  id: string;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  function errorHumanize(error: string) {
    if (error === "Unauthorized") return t("login.required");
    else if (error === "Content is required") return t("comment.empty");
    return error;
  }
  function submit() {
    client.feed
      .comment({ feed: id })
      .post(
        { content },
        {
          headers: headersWithAuth(),
        }
      )
      .then(({ error }) => {
        if (error) {
          setError(errorHumanize(error.value as string));
        } else {
          setContent("");
          setError("");
          alert(t("comment.success"));
          onRefresh();
        }
      });
  }
  return (
    <div className="w-full rounded-2xl bg-w t-primary m-2 p-6 items-end flex flex-col">
      <div className="flex flex-col w-full items-start space-y-4">
        <label htmlFor="comment">{t("comment.title")}</label>
        <textarea
          id="comment"
          placeholder={t("comment.placeholder.title")}
          className="bg-w w-full h-24 rounded-lg"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      <button
        className="mt-2 bg-theme text-white px-4 py-2 rounded-full"
        onClick={submit}
      >
        {t("comment.submit")}
      </button>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
}

type Comment = {
  id: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: number;
    username: string;
    avatar: string | null;
    permission: number | null;
  };
};

function Comments({ id }: { id: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string>();
  const ref = useRef("");
  const { t } = useTranslation();

  function loadComments() {
    client.feed
      .comment({ feed: id })
      .get({
        headers: headersWithAuth(),
      })
      .then(({ data, error }) => {
        if (error) {
          setError(error.value as string);
        } else if (data && Array.isArray(data)) {
          setComments(data);
        }
      });
  }
  useEffect(() => {
    if (ref.current == id) return;
    loadComments();
    ref.current = id;
  }, [id]);
  return (
    <>
      <div className="m-2 flex flex-col justify-center items-center">
        <CommentInput id={id} onRefresh={loadComments} />
        {error && (
          <>
            <div className="flex flex-col wauto rounded-2xl bg-w t-primary m-2 p-6 items-center justify-center">
              <h1 className="text-xl font-bold t-primary">{error}</h1>
              <button
                className="mt-2 bg-theme text-white px-4 py-2 rounded-full"
                onClick={loadComments}
              >
                {t("reload")}
              </button>
            </div>
          </>
        )}
        {comments.length > 0 && (
          <div className="w-full">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onRefresh={loadComments}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function CommentItem({
  comment,
  onRefresh,
}: {
  comment: Comment;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const profile = useContext(ProfileContext);
  function deleteComment() {
    if (!confirm(t("delete.comment.confirm"))) return;
    client
      .comment({ id: comment.id })
      .delete(null, {
        headers: headersWithAuth(),
      })
      .then(({ error }) => {
        if (error) {
          alert(error.value);
        } else {
          alert(t("delete.success"));
          onRefresh();
        }
      });
  }
  return (
    <div className="flex flex-row items-start rounded-xl mt-2">
      <img
        src={comment.user.avatar || ""}
        className="w-8 h-8 rounded-full mt-4"
      />
      <div className="flex flex-col flex-1 w-0 ml-2 bg-w rounded-xl p-4">
        <div className="flex flex-row">
          <span className="t-primary text-base font-bold">
            {comment.user.username}
          </span>
          <div className="flex-1 w-0" />
          <span
            title={new Date(comment.createdAt).toLocaleString()}
            className="text-gray-400 text-sm"
          >
            {format(comment.createdAt)}
          </span>
        </div>
        <p className="t-primary break-words">{comment.content}</p>
        <div className="flex flex-row justify-end">
          {(profile?.permission || profile?.id == comment.user.id) && (
            <Popup
              arrow={false}
              trigger={
                <button className="px-2 py bg-secondary rounded-full">
                  <i className="ri-more-fill t-secondary"></i>
                </button>
              }
              position="left center"
            >
              <div className="flex flex-row self-end mr-2">
                <button
                  onClick={deleteComment}
                  aria-label={t("delete.comment.title")}
                  className="px-2 py bg-secondary rounded-full"
                >
                  <i className="ri-delete-bin-2-line t-secondary"></i>
                </button>
              </div>
            </Popup>
          )}
        </div>
      </div>
    </div>
  );
}

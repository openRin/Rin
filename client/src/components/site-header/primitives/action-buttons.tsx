import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactModal from "react-modal";
import Popup from "reactjs-popup";
import { useLocation } from "wouter";
import { client } from "../../../app/runtime";
import { ClientConfigContext } from "../../../state/config";
import { type Profile } from "../../../state/profile";
import { removeAuthToken } from "../../../utils/auth";
import { Button } from "../../button";
import { Input } from "../../input";
import { HEADER_POPUP_PANEL_CLASS } from "../shared";

export function HeaderActions({
  profile,
  className = "",
  plain = false,
  popoverUp = false,
}: {
  profile?: Profile | null;
  className?: string;
  plain?: boolean;
  popoverUp?: boolean;
}) {
  return (
    <div className={className}>
      <SearchButton plain={plain} />
      <LanguageSwitch plain={plain} popoverUp={popoverUp} />
      <UserAvatar profile={profile} plain={plain} popoverUp={popoverUp} />
    </div>
  );
}

export function SearchButton({ className, onClose, plain = false }: { className?: string; onClose?: () => void; plain?: boolean }) {
  const { t } = useTranslation();
  const [isOpened, setIsOpened] = useState(false);
  const [, setLocation] = useLocation();
  const [value, setValue] = useState("");
  const label = t("article.search.title");

  const onSearch = () => {
    const key = `${encodeURIComponent(value)}`;
    setTimeout(() => {
      setIsOpened(false);
      if (value.length !== 0) onClose?.();
    }, 100);
    if (value.length !== 0) setLocation(`/search/${key}`);
  };

  return (
    <div className={className + " flex flex-row items-center"}>
      <button
        onClick={() => setIsOpened(true)}
        title={label}
        aria-label={label}
        className={
          plain
            ? "flex aspect-[1] items-center justify-center px-1.5 text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            : "flex rounded-full border dark:border-neutral-600 px-2 bg-w aspect-[1] items-center justify-center t-primary bg-button"
        }
      >
        <i className="ri-search-line" />
      </button>
      <ReactModal
        isOpen={isOpened}
        style={{
          content: {
            top: "20%",
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
            background: "none",
          },
          overlay: {
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 1000,
          },
        }}
        onRequestClose={() => setIsOpened(false)}
      >
        <div className="bg-w w-full flex flex-row items-center justify-between p-4 space-x-4">
          <Input value={value} setValue={setValue} placeholder={t("article.search.placeholder")} autofocus onSubmit={onSearch} />
          <Button title={value.length === 0 ? t("close") : label} onClick={onSearch} />
        </div>
      </ReactModal>
    </div>
  );
}

export function LanguageSwitch({ className, plain = false, popoverUp = false }: { className?: string; plain?: boolean; popoverUp?: boolean }) {
  const { i18n } = useTranslation();
  const languages = [
    { code: "en", name: "English" },
    { code: "zh-CN", name: "简体中文" },
    { code: "zh-TW", name: "繁體中文" },
    { code: "ja", name: "日本語" },
  ];

  return (
    <div className={className + " flex flex-row items-center"}>
      <Popup
        trigger={
          <button
            title="Languages"
            aria-label="Languages"
            className={
              plain
                ? "flex aspect-[1] items-center justify-center px-1.5 text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                : "flex rounded-full border dark:border-neutral-600 px-2 bg-w aspect-[1] items-center justify-center t-primary bg-button"
            }
          >
            <i className="ri-translate-2" />
          </button>
        }
        position={popoverUp ? "top left" : "bottom right"}
        arrow={false}
        closeOnDocumentClick
      >
        <div className={`${HEADER_POPUP_PANEL_CLASS} min-w-40`}>
          <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
            Languages
          </p>
          {languages.map(({ code, name }) => (
            <button
              key={code}
              onClick={() => i18n.changeLanguage(code)}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm t-primary transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            >
              {name}
            </button>
          ))}
        </div>
      </Popup>
    </div>
  );
}

export function UserAvatar({
  className,
  profile,
  plain = false,
  popoverUp = false,
}: {
  className?: string;
  profile?: Profile | null;
  plain?: boolean;
  popoverUp?: boolean;
}) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const label = t("github_login");
  const config = useContext(ClientConfigContext);
  const [isOpen, setIsOpen] = useState(false);
  const shouldShowEntry = Boolean(profile) || config.getBoolean("login.enabled");

  return shouldShowEntry ? (
    <div className={className + " flex flex-row items-center"}>
      {profile ? (
        <Popup
          arrow={false}
          position={popoverUp ? "top left" : "bottom right"}
          closeOnDocumentClick
          open={isOpen}
          onOpen={() => setIsOpen(true)}
          onClose={() => setIsOpen(false)}
          trigger={
            <button
              title={t("profile.title")}
              aria-label={t("profile.title")}
              className={
                plain
                  ? "group flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-neutral-500 transition-all hover:bg-black/5 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100"
                  : "flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-w dark:border-white/10"
              }
            >
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt="Avatar"
                  className="h-8 w-8 cursor-pointer rounded-full object-cover transition duration-200 group-hover:brightness-95"
                />
              ) : (
                <div className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-secondary transition-colors group-hover:bg-black/5 dark:group-hover:bg-white/10">
                  <i className="ri-user-line text-lg t-secondary" />
                </div>
              )}
            </button>
          }
        >
          <div className={`mt-3 flex min-w-44 flex-col ${HEADER_POPUP_PANEL_CLASS}`}>
            <button
              onClick={() => {
                setIsOpen(false);
                setLocation("/profile");
              }}
              className="mb-2 flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            >
              {profile.avatar ? (
                <img src={profile.avatar} alt="Avatar" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                  <i className="ri-user-line text-lg t-secondary" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold t-primary">{profile.name || t("profile.title")}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{t("profile.title")}</p>
              </div>
            </button>
            {profile.permission ? (
              <button
                onClick={() => {
                  setIsOpen(false);
                  setLocation("/admin/writing");
                }}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm t-primary transition-colors hover:bg-black/5 dark:hover:bg-white/10"
              >
                <i className="ri-dashboard-line" />
                <span>{t("admin.title")}</span>
              </button>
            ) : null}
            <button
              onClick={async () => {
                setIsOpen(false);
                await client.user.logout();
                removeAuthToken();
                window.location.reload();
              }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
            >
              <i className="ri-logout-circle-line" />
              <span>{t("logout")}</span>
            </button>
          </div>
        </Popup>
      ) : (
        <button
          onClick={() => setLocation("/login")}
          title={label}
          aria-label={label}
          className={
            plain
              ? "flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100"
              : "flex rounded-full border dark:border-neutral-600 px-2 bg-w aspect-[1] items-center justify-center t-primary bg-button"
          }
        >
          <i className="ri-user-received-line" />
        </button>
      )}
    </div>
  ) : null;
}

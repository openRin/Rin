import { useEffect, useRef, useState } from "react";
import Popup from "reactjs-popup";
import { useLocation } from "wouter";
import type { Profile } from "../../../state/profile";
import { LanguageSwitch, SearchButton, UserAvatar } from "./action-buttons";
import { NavBar } from "./nav-bar";

export function Menu({ profile }: { profile?: Profile | null }) {
  const [isOpen, setOpen] = useState(false);
  const [location] = useLocation();
  const previousOverflowRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (previousOverflowRef.current !== null) {
        document.body.style.overflow = previousOverflowRef.current;
        previousOverflowRef.current = null;
      }
      return;
    }

    previousOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflowRef.current ?? "";
      previousOverflowRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    setOpen(false);
  }, [location]);

  function onClose() {
    setOpen(false);
  }

  return (
    <div className="visible md:hidden flex flex-row items-center">
      <Popup
        arrow={false}
        trigger={
          <div>
            <button onClick={() => setOpen(true)} className="w-10 h-10 rounded-full flex flex-row items-center justify-center text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
              <i className="ri-menu-line ri-lg" />
            </button>
          </div>
        }
        position="bottom right"
        open={isOpen}
        nested
        onClose={onClose}
        closeOnDocumentClick
        closeOnEscape
        overlayStyle={{ background: "rgba(0,0,0,0.3)" }}
      >
        <div className={`mt-4 flex w-[50vw] flex-col rounded-2xl border border-black/10 bg-white p-2 shadow-lg shadow-black/5 dark:border-white/10 dark:bg-dark dark:shadow-black/20`}>
          <div className="flex flex-row justify-end space-x-2">
            <SearchButton onClose={onClose} />
            <LanguageSwitch />
            <UserAvatar profile={profile} />
          </div>
          <NavBar menu={true} onClick={onClose} />
        </div>
      </Popup>
    </div>
  );
}

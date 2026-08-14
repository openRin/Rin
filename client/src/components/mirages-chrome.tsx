import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const doc = document.documentElement;
        const total = doc.scrollHeight - window.innerHeight;
        const ratio = total > 0 ? window.scrollY / total : 0;
        setProgress(ratio);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (progress > 0 && progress < 1) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [progress]);

  useEffect(() => {
    setProgress(0);
    setVisible(false);
  }, [location]);

  return (
    <div
      className="fixed inset-x-0 top-0 z-[1170] h-[2px] transition-opacity duration-300"
      style={{
        opacity: visible ? 1 : 0,
        background: "linear-gradient(45deg, rgba(26,188,156,0), rgba(26,188,156,0.1) 25%, rgba(26,188,156,0.35) 50%, #1abc9c 75%, rgba(26,188,156,0.1))",
      }}
    >
      <div
        className="h-full bg-[#1abc9c]"
        style={{ width: `${progress * 100}%`, transition: "width 0.1s linear" }}
      />
    </div>
  );
}

export function BackTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShow(window.scrollY > 300);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className={`fixed bottom-6 right-6 z-[899] flex h-[44px] w-[44px] cursor-pointer items-center justify-center rounded-full border border-black/10 bg-white/80 text-neutral-600 shadow-[0_2px_5px_rgba(0,0,0,0.12)] backdrop-blur transition-all duration-500 hover:border-theme hover:text-theme dark:border-white/10 dark:bg-white/10 dark:text-neutral-300 ${show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}
    >
      <i className="ri-arrow-up-line ri-lg" />
    </button>
  );
}

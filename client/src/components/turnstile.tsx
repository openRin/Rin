import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile: any;
  }
}

export function Turnstile({ onSuccess }: { onSuccess: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    function render() {
      if (!window.turnstile || !ref.current) return;
      const id = window.turnstile.render(ref.current, {
        sitekey: process.env.TURNSTILE_SITE_KEY,
        callback: onSuccess,
      });
      return () => window.turnstile.remove(id);
    }
    if (window.turnstile) {
      return render();
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.onload = () => {
      render();
    };
    document.head.appendChild(script);
    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [onSuccess]);

  return <div ref={ref} className="cf-turnstile" />;
}

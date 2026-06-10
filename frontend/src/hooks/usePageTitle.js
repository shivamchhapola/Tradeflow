import { useEffect } from "react";
import { APP_TITLE } from "../lib/copy";

/**
 * Set document.title to "<page> · Tradeflow" while the component is mounted.
 * Restores the previous title on unmount.
 */
export default function usePageTitle(page) {
  useEffect(() => {
    const prev = document.title;
    document.title = page ? `${page} · ${APP_TITLE.base}` : APP_TITLE.base;
    return () => {
      document.title = prev;
    };
  }, [page]);
}

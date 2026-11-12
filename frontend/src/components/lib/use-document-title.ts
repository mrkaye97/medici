import { useEffect } from "react"

/** Set the browser tab title, e.g. "Apartment · Medici". */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · Medici` : "Medici"
  }, [title])
}

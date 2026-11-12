import createFetchClient from "openapi-fetch"
import createClient from "openapi-react-query"
import type { paths } from "schema"

export interface FetchError extends Error {
  status?: number
  response?: Response
}

/**
 * Development only: make the API feel like a slow or flaky production
 * server, to see loading and error states. Set either in `.env.local`
 * (`VITE_SIMULATED_LATENCY_MS=1200`) or, without restarting, in the
 * browser console:
 *
 *   localStorage.setItem("medici:latency", "1500")   // ms, ±50% jitter
 *   localStorage.setItem("medici:fail-rate", "0.2")  // fail 20% of requests
 *   localStorage.removeItem("medici:latency")        // back to normal
 *
 * Production builds drop all of this (`import.meta.env.DEV` is false).
 */
const simulateNetwork = async (input: Request) => {
  const read = (key: string) => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }

  const latency = Number(
    read("medici:latency") ?? import.meta.env.VITE_SIMULATED_LATENCY_MS ?? 0
  )
  if (latency > 0) {
    const jittered = latency * (0.5 + Math.random())
    await new Promise(resolve => setTimeout(resolve, jittered))
  }

  const failRate = Number(
    read("medici:fail-rate") ?? import.meta.env.VITE_SIMULATED_FAIL_RATE ?? 0
  )
  // Never fail logins, so you can't lock yourself out while testing.
  if (
    failRate > 0 &&
    Math.random() < failRate &&
    !input.url.includes("/login")
  ) {
    const error = new Error(
      "Simulated network failure (medici:fail-rate)"
    ) as FetchError
    error.status = 503
    throw error
  }
}

const fetchWithStatus = async (input: Request): Promise<Response> => {
  if (import.meta.env.DEV) {
    await simulateNetwork(input)
  }

  const response = await fetch(input)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const error = new Error(errorData.error || "Request failed") as FetchError
    error.status = response.status
    error.response = response
    throw error
  }

  return response
}

export const fetchClient = createFetchClient<paths>({
  baseUrl: import.meta.env.VITE_API_URL,
  fetch: fetchWithStatus,
})
export const apiClient = createClient(fetchClient)

/** The server's error message for a failed request, or `fallback`. */
export const errorMessage = (error: unknown, fallback: string): string => {
  if (
    error instanceof Error &&
    error.message &&
    error.message !== "Request failed"
  ) {
    return error.message
  }
  return fallback
}

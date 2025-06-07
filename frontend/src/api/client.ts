import createFetchClient from "openapi-fetch"
import createClient from "openapi-react-query"
import type { paths } from "schema"

export interface FetchError extends Error {
  status?: number
  response?: Response
}

const fetchWithStatus = async (input: Request): Promise<Response> => {
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

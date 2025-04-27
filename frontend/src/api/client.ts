import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";
import type { paths } from "schema";

export const fetchClient = createFetchClient<paths>({
  baseUrl: import.meta.env.VITE_API_URL,
});
export const apiClient = createClient(fetchClient);

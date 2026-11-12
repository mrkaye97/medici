import { apiClient, errorMessage } from "@/api/client"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { jwtDecode } from "jwt-decode"
import { createContext, useContext, useMemo, useState } from "react"

type DecodedToken =
  | {
      isAuthenticated: boolean
      memberId: string
    }
  | {
      isAuthenticated: false
      memberId: null
    }

const parseJWT = (token: string | null): DecodedToken => {
  if (!token) {
    return {
      isAuthenticated: false,
      memberId: null,
    }
  }

  try {
    const decoded = jwtDecode(token)

    const iat = decoded.iat ? new Date(decoded.iat * 1000) : null
    const exp = decoded.exp ? new Date(decoded.exp * 1000) : null
    const memberId = decoded.sub || null

    if (!iat || !exp || !memberId) {
      return {
        isAuthenticated: false,
        memberId: null,
      }
    }

    if (exp && exp < new Date()) {
      return {
        isAuthenticated: false,
        memberId: null,
      }
    }

    return {
      isAuthenticated: true,
      memberId,
    }
  } catch (error) {
    console.error("Failed to decode JWT:", error)
    return {
      isAuthenticated: false,
      memberId: null,
    }
  }
}

export function useAuthInner() {
  const [token, setToken] = useState(() => localStorage.getItem("token"))
  const { isAuthenticated, memberId } = useMemo(() => parseJWT(token), [token])

  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const loginMutation = apiClient.useMutation("post", "/api/login")
  const signupMutation = apiClient.useMutation("post", "/api/signup")

  const setAuthMetadata = async ({ token }: { token: string }) => {
    localStorage.setItem("token", token)

    setToken(token)

    await queryClient.invalidateQueries()
  }

  const clearAuthMetadata = async () => {
    setToken(null)
    localStorage.removeItem("token")

    await queryClient.invalidateQueries()
  }

  /** Store a session token from the server and go to the home page. */
  const completeLogin = async (token: string) => {
    await setAuthMetadata({ token })
    navigate({ to: "/", reloadDocument: true })
  }

  /** Returns `null` on success, or a message saying what went wrong. */
  const login = async (
    email: string,
    password: string
  ): Promise<string | null> => {
    try {
      const result = await loginMutation.mutateAsync({
        body: { email, password },
      })

      if (result.is_authenticated && result.token) {
        await completeLogin(result.token)
        return null
      }

      return "Invalid email or password"
    } catch (error) {
      await clearAuthMetadata()
      return errorMessage(error, "Invalid email or password")
    }
  }

  const logout = async () => {
    await clearAuthMetadata()

    navigate({ to: "/login", reloadDocument: true })
  }

  /** Returns `null` on success, or a message saying what went wrong. */
  const signup = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ): Promise<string | null> => {
    try {
      const result = await signupMutation.mutateAsync({
        body: {
          email,
          password,
          first_name: firstName,
          last_name: lastName,
        },
      })

      if (result.is_authenticated && result.token) {
        await completeLogin(result.token)
        return null
      }

      return "Couldn't create your account. Please try again."
    } catch (error) {
      await clearAuthMetadata()
      return errorMessage(
        error,
        "Couldn't create your account. Please try again."
      )
    }
  }

  const createAuthHeader = () => {
    return {
      Authorization: `Bearer ${token}`,
    }
  }

  return {
    isAuthenticated,
    login,
    logout,
    signup,
    completeLogin,
    createAuthHeader,
    memberId,
  }
}

const AuthContext = createContext<ReturnType<typeof useAuthInner> | null>(null)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const auth = useAuthInner()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context)
    throw new Error("useAuthContext must be used within AuthProvider")
  return context
}

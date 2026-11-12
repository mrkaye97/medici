import { apiClient } from "@/api/client"
import { LoginForm } from "@/components/login-form"
import { useAuth } from "@/hooks/use-auth"
import { createFileRoute, Navigate } from "@tanstack/react-router"
import { useState } from "react"
import { z } from "zod"

const fallback = "/" as const

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: z.object({
    redirect: z.string().optional().catch(""),
  }),
})

function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { data: resetConfig } = apiClient.useQuery(
    "get",
    "/api/password-reset/config"
  )

  if (isAuthenticated) {
    return <Navigate to={fallback} />
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <LoginForm
        onSubmit={async (_e, { email, password }) => {
          setError(null)
          setIsSubmitting(true)

          const failure = await login(email, password)

          setIsSubmitting(false)
          setError(failure)
        }}
        formType="login"
        error={error}
        isSubmitting={isSubmitting}
        showForgotPassword={resetConfig?.enabled ?? false}
      />
    </div>
  )
}

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
  const [isError, setIsError] = useState(false)

  if (isAuthenticated) {
    return <Navigate to={fallback} />
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <LoginForm
        onSubmit={async e => {
          setIsError(false)
          const email = e.currentTarget.email.value as string
          const password = e.currentTarget.password.value as string

          const result = await login(email, password)

          if (!result) {
            setIsError(true)
          }
        }}
        formType="login"
        hasError={isError}
      />
    </div>
  )
}

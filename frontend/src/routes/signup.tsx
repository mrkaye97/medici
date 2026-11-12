import { useDocumentTitle } from "@/components/lib/use-document-title"
import { LoginForm } from "@/components/login-form"

import { useAuth } from "@/hooks/use-auth"
import { createFileRoute, Navigate } from "@tanstack/react-router"
import { useState } from "react"
import { z } from "zod"

const fallback = "/" as const

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  validateSearch: z.object({
    redirect: z.string().optional().catch(""),
  }),
})

function SignupPage() {
  useDocumentTitle("Sign up")
  const { isAuthenticated, signup } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isAuthenticated) {
    return <Navigate to={fallback} />
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <LoginForm
        onSubmit={async (_e, { email, password, firstName, lastName }) => {
          setError(null)
          setIsSubmitting(true)

          const failure = await signup(
            email,
            password,
            firstName ?? "",
            lastName ?? ""
          )

          setIsSubmitting(false)
          setError(failure)
        }}
        formType="signup"
        error={error}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}

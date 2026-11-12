import { apiClient, errorMessage } from "@/api/client"
import { AuthLayout } from "@/components/auth-layout"
import { useDocumentTitle } from "@/components/lib/use-document-title"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { z } from "zod"

const MIN_PASSWORD_LENGTH = 8

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  validateSearch: z.object({
    token: z.string().optional().catch(undefined),
  }),
})

function ResetPasswordPage() {
  useDocumentTitle("Reset password")
  const { token: tokenFromUrl } = Route.useSearch()
  const { completeLogin } = useAuth()
  // Keep the token in memory only.
  const [token] = useState(tokenFromUrl)
  const [error, setError] = useState<string | null>(null)
  const { mutateAsync: confirmReset, isPending } = apiClient.useMutation(
    "post",
    "/api/password-reset/confirm"
  )

  // Take the token out of the address bar so it isn't left in browser
  // history or picked up by anything that reads the URL.
  useEffect(() => {
    if (tokenFromUrl) {
      window.history.replaceState(null, "", "/reset-password")
    }
  }, [tokenFromUrl])

  return (
    <AuthLayout>
      <CardHeader>
        <CardTitle className="text-xl">Choose a new password</CardTitle>
        <CardDescription>
          You&apos;ll be logged in, and logged out everywhere else.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!token ? (
          <Alert variant="destructive">
            <AlertTitle>This link is incomplete</AlertTitle>
            <AlertDescription>
              Open the link from your email again, or request a new one.
            </AlertDescription>
          </Alert>
        ) : (
          <form
            className="flex flex-col gap-6"
            onSubmit={async e => {
              e.preventDefault()
              setError(null)
              const data = new FormData(e.currentTarget)
              const password = data.get("password") as string
              const confirm = data.get("confirm") as string

              if (password !== confirm) {
                setError("The passwords don't match")
                return
              }

              try {
                const result = await confirmReset({
                  body: { token, new_password: password },
                })
                if (result.is_authenticated && result.token) {
                  await completeLogin(result.token)
                }
              } catch (err) {
                setError(
                  errorMessage(err, "Couldn't reset your password. Try again.")
                )
              }
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
              <p className="text-muted-foreground text-xs">
                At least {MIN_PASSWORD_LENGTH} characters
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Saving..." : "Set new password"}
            </Button>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </form>
        )}
        <Link to="/forgot-password">
          <p className="mt-4 text-center text-sm underline underline-offset-4">
            Request a new link
          </p>
        </Link>
      </CardContent>
    </AuthLayout>
  )
}

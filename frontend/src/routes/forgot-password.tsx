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
import { createFileRoute, Link } from "@tanstack/react-router"
import { MailCheck } from "lucide-react"
import { useState } from "react"

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  useDocumentTitle("Forgot password")
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { mutateAsync: requestReset, isPending } = apiClient.useMutation(
    "post",
    "/api/password-reset/request"
  )

  return (
    <AuthLayout>
      <CardHeader>
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>
          {sentTo
            ? "Check your email"
            : "Enter the email you use for Medici and we'll send you a reset link"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sentTo ? (
          <div className="space-y-4">
            <Alert>
              <MailCheck className="h-4 w-4" />
              <AlertTitle>Reset link on its way</AlertTitle>
              <AlertDescription>
                If an account uses {sentTo}, we&apos;ve sent it a link to choose
                a new password. The link expires in 30 minutes. Check your spam
                folder if you don&apos;t see it.
              </AlertDescription>
            </Alert>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setSentTo(null)}
            >
              Use a different email
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-6"
            onSubmit={async e => {
              e.preventDefault()
              setError(null)
              const email = new FormData(e.currentTarget).get("email") as string

              try {
                await requestReset({ body: { email } })
                setSentTo(email.trim())
              } catch (err) {
                setError(
                  errorMessage(err, "Something went wrong. Please try again.")
                )
              }
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Sending..." : "Send reset link"}
            </Button>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </form>
        )}
        <Link to="/login">
          <p className="mt-4 text-center text-sm underline underline-offset-4">
            Back to log in
          </p>
        </Link>
      </CardContent>
    </AuthLayout>
  )
}

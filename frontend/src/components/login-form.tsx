import { Link } from "@tanstack/react-router"
import { FormEvent, useCallback } from "react"
import { AuthLayout } from "./auth-layout"
import { Alert, AlertDescription } from "./ui/alert"
import { Button } from "./ui/button"
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

type LoginFormProps = {
  onSubmit: (
    e: FormEvent<HTMLFormElement>,
    formData: {
      email: string
      password: string
      firstName?: string | null
      lastName?: string | null
    }
  ) => void
  formType: "login" | "signup"
  /** Shown above the submit button when set. */
  error?: string | null
  /** Show "Forgot password?" (only when the server can send reset emails). */
  showForgotPassword?: boolean
  isSubmitting?: boolean
}

export function LoginForm({
  onSubmit,
  formType,
  error,
  showForgotPassword,
  isSubmitting,
}: LoginFormProps) {
  const isLogin = formType === "login"

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()

      const formData = new FormData(e.currentTarget)
      onSubmit(e, {
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        firstName: formData.get("firstName") as string | null,
        lastName: formData.get("lastName") as string | null,
      })
    },
    [onSubmit]
  )

  return (
    <AuthLayout>
      <CardHeader>
        <CardTitle className="text-xl">
          {isLogin ? "Welcome back" : "Create your account"}
        </CardTitle>
        <CardDescription>
          {isLogin
            ? "Log in to see your pools and balances."
            : "Track shared expenses and settle up with friends."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isLogin && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  autoComplete="given-name"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  autoComplete="family-name"
                  required
                />
              </div>
            </div>
          )}
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
          <div className="grid gap-2">
            <div className="flex items-center">
              <Label htmlFor="password">Password</Label>
              {isLogin && showForgotPassword && (
                <Link
                  to="/forgot-password"
                  className="text-muted-foreground hover:text-foreground ml-auto text-sm underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              )}
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={isLogin ? undefined : 8}
              required
            />
            {!isLogin && (
              <p className="text-muted-foreground text-xs">
                At least 8 characters
              </p>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
            {isSubmitting
              ? isLogin
                ? "Logging in..."
                : "Creating account..."
              : isLogin
                ? "Log in"
                : "Create account"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center border-t pt-4 text-sm">
        <span className="text-muted-foreground">
          {isLogin ? "New to Medici?" : "Already have an account?"}
        </span>
        <Link
          to={isLogin ? "/signup" : "/login"}
          className="text-primary ml-1 font-medium underline-offset-4 hover:underline"
        >
          {isLogin ? "Create an account" : "Log in"}
        </Link>
      </CardFooter>
    </AuthLayout>
  )
}

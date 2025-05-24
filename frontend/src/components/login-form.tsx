import { Link } from "@tanstack/react-router";
import { cn } from "./lib/utils";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { FormEvent, useCallback } from "react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

type LoginFormProps = {
  className?: string;
  onSubmit: (
    e: FormEvent<HTMLFormElement>,
    formData: {
      email: string;
      password: string;
      firstName?: string | null;
      lastName?: string | null;
    }
  ) => void;
  formType: "login" | "signup";
  hasError?: boolean;
};

export function LoginForm({
  className,
  onSubmit,
  formType,
  hasError,
}: LoginFormProps) {
  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const formData = new FormData(e.currentTarget);
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;
      const firstName = formData.get("firstName") as string | null;
      const lastName = formData.get("lastName") as string | null;

      if (onSubmit) {
        onSubmit(e, { email, password, firstName, lastName });
      }
    },
    [onSubmit]
  );

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <Card className="min-w-[500px]">
        <CardHeader>
          <CardTitle className="text-2xl">
            {formType === "login" ? "Log In" : "Sign Up"}
          </CardTitle>
          <CardDescription>
            {formType === "login"
              ? "Enter your email below to login to your account"
              : "Create an account to get started"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="anna@thekarenin.as"
                  required
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input id="password" name="password" type="password" required />
              </div>
              {formType === "signup" && (
                <div className="grid gap-2">
                  <Label htmlFor="email">First Name</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder="Anna"
                    required
                  />
                </div>
              )}
              {formType === "signup" && (
                <div className="grid gap-2">
                  <Label htmlFor="email">Last Name</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    type="text"
                    placeholder="Karenina"
                    required
                  />
                </div>
              )}
              <Button type="submit" className="w-full">
                {formType === "login" ? "Login" : "Sign Up"}
              </Button>
            </div>
          </form>
          {formType === "login" ? (
            <Link to="/signup">
              <div className="mt-4 text-center text-sm">
                Don&apos;t have an account?{" "}
                <p className="underline underline-offset-4">Sign up</p>
              </div>
            </Link>
          ) : (
            <Link to="/login">
              <div className="mt-4 text-center text-sm">
                Already have an account?{" "}
                <p className="underline underline-offset-4">Log in</p>
              </div>
            </Link>
          )}{" "}
          {hasError && (
            <div className="mt-4">
              <Alert variant="destructive">
                <AlertTitle>Login failed</AlertTitle>
                <AlertDescription>Invalid email or password</AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

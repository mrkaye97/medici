"use client";

import { LoginForm } from "../src/components/login-form";

import { useAuth } from "../src/hooks/auth";

const fallback = "/" as const;

export default function SignupPage() {
  const { isAuthenticated, signup } = useAuth();

  console.log("Rendering signup page", fallback);

  console.log(isAuthenticated);

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="flex flex-col justify-center items-center h-full">
      <LoginForm
        onSubmit={async (e) => {
          const email = e.currentTarget.email.value as string;
          const password = e.currentTarget.password.value as string;
          const firstName = e.currentTarget.firstName.value as string;
          const lastName = e.currentTarget.lastName.value as string;

          await signup(email, password, firstName, lastName);
        }}
        formType="signup"
      />
    </div>
  );
}

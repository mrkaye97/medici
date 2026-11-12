import { Card } from "@/components/ui/card"

/** Shared frame for the logged-out pages: logo, name, and one card. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <img
          src="/favicon.svg"
          alt=""
          className="size-12 rounded-xl shadow-sm"
        />
        <div>
          <p className="text-foreground text-2xl font-semibold tracking-tight">
            Medici
          </p>
          <p className="text-muted-foreground text-sm">
            Split shared expenses with friends
          </p>
        </div>
      </div>
      <Card className="w-full max-w-sm shadow-sm">{children}</Card>
    </div>
  )
}

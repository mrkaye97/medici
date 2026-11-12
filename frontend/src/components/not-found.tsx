import { Button } from "@/components/ui/button"
import { Link } from "@tanstack/react-router"

export function NotFound(
  props: Readonly<{
    children?: React.ReactNode
  }>
) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-foreground text-2xl font-semibold">Page not found</p>
      <div className="text-muted-foreground">
        {props.children || <p>The page you are looking for does not exist.</p>}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" onClick={() => window.history.back()}>
          Go back
        </Button>
        <Button asChild>
          <Link to="/">Home</Link>
        </Button>
      </div>
    </div>
  )
}

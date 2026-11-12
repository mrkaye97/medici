import { apiClient, errorMessage } from "@/api/client"
import { initials } from "@/components/lib/format"
import { usePlaceholder } from "@/components/lib/placeholders"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"
import { useQueryClient } from "@tanstack/react-query"
import { KeyRound, LogOut, Wallet } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

const MIN_PASSWORD_LENGTH = 8

/** Avatar button with your account settings: Venmo handle, password, log out. */
export function AccountMenu() {
  const { memberId, createAuthHeader, logout } = useAuth()
  const [dialog, setDialog] = useState<"venmo" | "password" | null>(null)

  const { data: member } = apiClient.useQuery(
    "get",
    "/api/members/me",
    { headers: createAuthHeader() },
    { enabled: !!memberId }
  )

  if (!member) {
    return <div className="size-9" />
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="bg-primary text-primary-foreground focus-visible:ring-ring flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold hover:cursor-pointer hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            aria-label="Account menu"
          >
            {initials(member.first_name, member.last_name)}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="font-normal">
            <p className="font-medium">
              {member.first_name} {member.last_name}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {member.email}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialog("venmo")}>
            <Wallet className="size-4" />
            <span className="flex-1">Venmo handle</span>
            <span className="text-muted-foreground max-w-24 truncate text-xs">
              {member.venmo_handle ? `@${member.venmo_handle}` : "Not set"}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("password")}>
            <KeyRound className="size-4" />
            Change password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => logout()}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="text-destructive size-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <VenmoDialog
        isOpen={dialog === "venmo"}
        onClose={() => setDialog(null)}
        current={member.venmo_handle ?? ""}
      />
      <ChangePasswordDialog
        isOpen={dialog === "password"}
        onClose={() => setDialog(null)}
      />
    </>
  )
}

function VenmoDialog({
  isOpen,
  onClose,
  current,
}: {
  isOpen: boolean
  onClose: () => void
  current: string
}) {
  const handlePlaceholder = usePlaceholder("venmoHandle", "")
  const { createAuthHeader } = useAuth()
  const queryClient = useQueryClient()
  const [handle, setHandle] = useState(current)
  const [error, setError] = useState<string | null>(null)
  const { mutateAsync: updateMember, isPending } = apiClient.useMutation(
    "patch",
    "/api/members/me"
  )

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (open) {
          return
        }
        onClose()
        setHandle(current)
        setError(null)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Venmo handle</DialogTitle>
          <DialogDescription>
            Friends in your pools get a Venmo button to pay you or request money
            from you. Leave it empty to remove it.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async e => {
            e.preventDefault()
            setError(null)
            try {
              // An empty string clears the handle.
              await updateMember({
                body: { venmo_handle: handle.trim() },
                headers: createAuthHeader(),
              })
              await queryClient.invalidateQueries({ queryKey: ["get", "/api"] })
              toast.success(
                handle.trim() ? "Venmo handle saved" : "Venmo handle removed"
              )
              onClose()
            } catch (err) {
              setError(errorMessage(err, "Couldn't save your Venmo handle"))
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="venmo-handle">Handle</Label>
            <Input
              id="venmo-handle"
              placeholder={handlePlaceholder}
              value={handle}
              onChange={e => setHandle(e.target.value)}
              autoComplete="off"
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Saving..." : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ChangePasswordDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const { createAuthHeader, setSession } = useAuth()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const { mutateAsync: changePassword, isPending } = apiClient.useMutation(
    "post",
    "/api/members/me/password"
  )

  const reset = () => {
    setCurrent("")
    setNext("")
    setConfirm("")
    setError(null)
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (open) {
          return
        }
        onClose()
        reset()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            You&apos;ll stay logged in here. Every other device will be logged
            out.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async e => {
            e.preventDefault()
            setError(null)
            if (next !== confirm) {
              setError("The new passwords don't match")
              return
            }
            try {
              const result = await changePassword({
                body: { current_password: current, new_password: next },
                headers: createAuthHeader(),
              })
              await setSession(result.token)
              toast.success("Password changed")
              onClose()
              reset()
            } catch (err) {
              setError(errorMessage(err, "Couldn't change your password"))
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={e => setCurrent(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={next}
              onChange={e => setNext(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              At least {MIN_PASSWORD_LENGTH} characters
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Changing..." : "Change password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

import { apiClient, errorMessage } from "@/api/client"
import { useAuth } from "@/hooks/use-auth"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { CircleCheck, Loader2, UserRoundX } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { components } from "schema"
import { z } from "zod"
import { Alert, AlertDescription } from "./ui/alert"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form"
import { Input } from "./ui/input"

const friendRequestSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
})

type FriendRequestFormValues = z.infer<typeof friendRequestSchema>
type MemberSummary = components["schemas"]["MemberSummary"]
type Relationship = components["schemas"]["Relationship"]
type FriendRequestOutcome = components["schemas"]["FriendRequestOutcome"]

const useDebouncedValue = <T,>(value: T, delayMs: number) => {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])
  return debounced
}

const MemberCard = ({
  member,
  note,
}: {
  member: MemberSummary
  note?: string
}) => (
  <div className="bg-muted/50 flex items-center gap-3 rounded-lg border p-3">
    <div className="bg-primary/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
      <span className="text-xs font-medium">
        {member.first_name[0]}
        {member.last_name[0]}
      </span>
    </div>
    <div className="min-w-0">
      <p className="truncate text-sm font-medium">
        {member.first_name} {member.last_name}
      </p>
      <p className="text-muted-foreground truncate text-xs">{member.email}</p>
      {note && <p className="text-muted-foreground mt-1 text-xs">{note}</p>}
    </div>
  </div>
)

/** What the submit button says and whether it does anything. */
const actionFor = (relationship: Relationship, member: MemberSummary) => {
  switch (relationship) {
    case "not_friends":
      return {
        label: `Send friend request to ${member.first_name}`,
        enabled: true,
      }
    case "request_received":
      return { label: `Accept ${member.first_name}'s request`, enabled: true }
    case "request_sent":
      return { label: "Request already sent", enabled: false }
    case "already_friends":
      return { label: "Already friends", enabled: false }
    case "yourself":
      return { label: "That's you", enabled: false }
  }
}

const noteFor = (relationship: Relationship, member: MemberSummary) => {
  switch (relationship) {
    case "request_received":
      return `${member.first_name} already sent you a request.`
    case "request_sent":
      return `You've already sent ${member.first_name} a request. It's waiting for them to accept.`
    case "already_friends":
      return `You and ${member.first_name} are already friends.`
    case "yourself":
      return "This is your own email."
    default:
      return undefined
  }
}

const successMessage = (
  outcome: FriendRequestOutcome,
  member: MemberSummary
) => {
  const name = `${member.first_name} ${member.last_name}`
  switch (outcome) {
    case "sent":
      return `Friend request sent to ${name}. You'll see them in your friends once they accept.`
    case "accepted":
      return `You and ${name} are now friends.`
    case "already_friends":
      return `You and ${name} are already friends.`
    case "already_sent":
      return `You've already sent ${name} a request.`
  }
}

export function AddFriendModal({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { memberId, createAuthHeader } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    outcome: FriendRequestOutcome
    member: MemberSummary
  } | null>(null)

  const { mutateAsync: createFriendRequest, isPending } = apiClient.useMutation(
    "post",
    "/api/friend-requests"
  )

  const form = useForm<FriendRequestFormValues>({
    resolver: zodResolver(friendRequestSchema),
    defaultValues: {
      email: "",
    },
  })

  const email = form.watch("email").trim()
  const debouncedEmail = useDebouncedValue(email, 350)
  const isValidEmail = friendRequestSchema.safeParse({
    email: debouncedEmail,
  }).success

  const { data: lookup, isFetching: isLookingUp } = apiClient.useQuery(
    "get",
    "/api/members/lookup",
    {
      params: { query: { email: debouncedEmail } },
      headers: createAuthHeader(),
    },
    { enabled: isOpen && isValidEmail && !!memberId }
  )

  // Only trust the lookup if it's for what's in the box right now.
  const lookupIsCurrent =
    isValidEmail && debouncedEmail === email && !isLookingUp

  const reset = () => {
    form.reset()
    setResult(null)
    setSubmitError(null)
  }

  if (!memberId) {
    return null
  }

  const action =
    lookupIsCurrent && lookup?.member && lookup.relationship
      ? actionFor(lookup.relationship, lookup.member)
      : null

  return (
    <Dialog
      open={isOpen}
      onOpenChange={value => {
        setIsOpen(value)
        if (!value) {
          reset()
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a friend</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <Alert>
              <CircleCheck className="h-4 w-4 text-green-600" />
              <AlertDescription>
                {successMessage(result.outcome, result.member)}
              </AlertDescription>
            </Alert>
            <MemberCard member={result.member} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={reset}>
                Add another
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setIsOpen(false)
                  reset()
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(async data => {
                setSubmitError(null)
                try {
                  const response = await createFriendRequest({
                    body: {
                      friend_email: data.email.trim(),
                    },
                    headers: createAuthHeader(),
                  })

                  await Promise.all([
                    queryClient.invalidateQueries({
                      queryKey: ["get", "/api/friend-requests"],
                    }),
                    queryClient.invalidateQueries({
                      queryKey: ["get", "/api/friends"],
                    }),
                    queryClient.invalidateQueries({
                      queryKey: ["get", "/api/members/lookup"],
                    }),
                  ])

                  setResult(response)
                } catch (error) {
                  setSubmitError(
                    errorMessage(
                      error,
                      "Failed to send friend request. Please try again."
                    )
                  )
                }
              })}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Friend&apos;s email address</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="anna@example.com"
                        autoComplete="off"
                        {...field}
                        type="email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div aria-live="polite" className="min-h-[3.75rem]">
                {isValidEmail && !lookupIsCurrent && (
                  <p className="text-muted-foreground flex items-center gap-2 py-3 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Looking up {email}…
                  </p>
                )}
                {lookupIsCurrent && lookup && !lookup.member && (
                  <div className="text-muted-foreground flex items-start gap-3 rounded-lg border border-dashed p-3 text-sm">
                    <UserRoundX className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      No Medici account uses this email. Check the spelling, or
                      ask them to sign up first.
                    </p>
                  </div>
                )}
                {lookupIsCurrent && lookup?.member && lookup.relationship && (
                  <MemberCard
                    member={lookup.member}
                    note={noteFor(lookup.relationship, lookup.member)}
                  />
                )}
              </div>

              {submitError && (
                <Alert variant="destructive">
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isPending || !action?.enabled}
              >
                {isPending
                  ? "Sending..."
                  : (action?.label ?? "Send friend request")}
              </Button>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}

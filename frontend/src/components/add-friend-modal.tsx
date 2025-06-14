import { apiClient } from "@/api/client"
import { useAuth } from "@/hooks/use-auth"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { z } from "zod"
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
  email: z.string().email("Invalid email address"),
})

type FriendRequestFormValues = z.infer<typeof friendRequestSchema>

export function AddFriendModal({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { memberId, createAuthHeader } = useAuth()
  const { mutateAsync: createFriendRequest, isPending } = apiClient.useMutation(
    "post",
    "/api/members/{member_id}/friend-requests"
  )

  const form = useForm<FriendRequestFormValues>({
    resolver: zodResolver(friendRequestSchema),
    defaultValues: {
      email: "",
    },
  })

  if (!memberId) {
    return null
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={value => {
        setIsOpen(value)
        if (!value) {
          form.reset()
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a friend</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async data => {
              try {
                await createFriendRequest({
                  body: {
                    friend_email: data.email,
                  },
                  params: {
                    path: {
                      member_id: memberId,
                    },
                  },
                  headers: createAuthHeader(),
                })

                await queryClient.invalidateQueries({
                  queryKey: ["get", "/api/members/{member_id}/friend-requests"],
                })

                setIsOpen(false)
                form.reset()
              } catch (error) {
                console.error("Failed to send friend request:", error)
                alert("Failed to send friend request. Please try again.")
              }
            })}
            className="space-y-6"
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
                      {...field}
                      type="email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Sending..." : "Send friend request"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

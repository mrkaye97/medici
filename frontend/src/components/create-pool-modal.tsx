import { apiClient, errorMessage } from "@/api/client"
import { useAuth } from "@/hooks/use-auth"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
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

const poolSchema = z.object({
  poolName: z.string().min(1, "Required"),
  poolDescription: z.string().optional(),
})

type PoolFormValues = z.infer<typeof poolSchema>

export function CreatePoolModal({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { memberId, createAuthHeader } = useAuth()
  const { mutateAsync: createPool, isPending } = apiClient.useMutation(
    "post",
    "/api/pools"
  )

  const form = useForm<PoolFormValues>({
    resolver: zodResolver(poolSchema),
    defaultValues: {
      poolName: "",
      poolDescription: "",
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a pool</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async data => {
              try {
                await createPool({
                  body: {
                    name: data.poolName,
                    description: data.poolDescription ?? undefined,
                  },
                  headers: createAuthHeader(),
                })

                await queryClient.invalidateQueries({
                  queryKey: ["get", "/api/pools"],
                })

                toast.success(`Created ${data.poolName}`)
                setIsOpen(false)
                form.reset()
              } catch (error) {
                form.setError("root.server", {
                  message: errorMessage(
                    error,
                    "Failed to create pool. Please try again."
                  ),
                })
              }
            })}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="poolName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Trip to Yosemite"
                      {...field}
                      type="text"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="poolDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      {...field}
                      placeholder="Friends trip to Yosemite, Spring 2025"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.formState.errors.root?.server && (
              <Alert variant="destructive">
                <AlertDescription>
                  {form.formState.errors.root.server.message}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsOpen(false)
                  form.reset()
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create pool"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

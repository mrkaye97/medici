import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/auth";
import { apiClient } from "@/api/client";

const poolSchema = z.object({
  poolName: z.string().min(1, "Required"),
  poolDescription: z.string().min(1, "Required"),
});

type PoolFormValues = z.infer<typeof poolSchema>;

export function CreatePoolModal({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { id } = useAuth();
  const { mutateAsync: createPool } = apiClient.useMutation(
    "post",
    "/api/pools"
  );

  const { mutateAsync: createPoolMembership } = apiClient.useMutation(
    "post",
    "/api/pools/{pool_id}/memberships"
  );

  const form = useForm<PoolFormValues>({
    resolver: zodResolver(poolSchema),
    defaultValues: {
      poolName: "",
      poolDescription: "",
    },
  });

  if (!id) {
    return null;
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(value) => {
        setIsOpen(value);
        if (!value) {
          form.reset();
        }
      }}
    >
      <DialogContent className="ml-32">
        <DialogHeader>
          <DialogTitle>Create a pool</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (data) => {
              const pool = await createPool({
                body: {
                  name: data.poolName,
                  description: data.poolDescription,
                },
              });

              if (!pool) {
                console.error("Failed to create pool");
                return;
              }

              await createPoolMembership({
                params: {
                  query: {
                    member_id: id,
                  },
                  path: {
                    pool_id: pool.id,
                  },
                },
              });

              await queryClient.invalidateQueries({
                queryKey: ["get", "/api/members/{member_id}/pools"],
              });

              setIsOpen(false);
              form.reset();
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="poolName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pool Name</FormLabel>
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
                  <FormLabel>Pool Description</FormLabel>
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

            <Button type="submit">Create Pool</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

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
import { useTRPC } from "../../trpc/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { useAuth } from "../hooks/auth";
import { Navigate } from "@tanstack/react-router";

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
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { id } = useAuth();
  const { mutateAsync: createPool } = useMutation(
    trpc.createPool.mutationOptions(),
  );
  const { mutateAsync: createPoolMembership } = useMutation(
    trpc.createPoolMembership.mutationOptions(),
  );

  const form = useForm<PoolFormValues>({
    resolver: zodResolver(poolSchema),
    defaultValues: {
      poolName: "",
      poolDescription: "",
    },
  });

  if (!id) {
    return <Navigate to="/login" />;
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
                name: data.poolName,
                description: data.poolDescription,
              });

              if (!pool) {
                console.error("Failed to create pool");
                return;
              }

              await createPoolMembership({
                poolId: pool.id,
                memberId: id,
              });

              await queryClient.invalidateQueries({
                queryKey: trpc.listPoolsForMember.queryKey(),
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

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

const friendRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type FriendRequestFormValues = z.infer<typeof friendRequestSchema>;

export function AddFriendModal({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { id } = useAuth();
  const { mutateAsync: createFriendRequest } = useMutation(
    trpc.createFriendRequest.mutationOptions(),
  );

  const form = useForm<FriendRequestFormValues>({
    resolver: zodResolver(friendRequestSchema),
    defaultValues: {
      email: "",
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
          <DialogTitle>Add a friend</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (data) => {
              await createFriendRequest({
                friendEmail: data.email,
                memberId: id,
              });

              await queryClient.invalidateQueries({
                queryKey: trpc.listFriends.queryKey(),
              });

              setIsOpen(false);
              form.reset();
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Friend email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="anna@thekarenin.as"
                      {...field}
                      type="text"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit">Send friend request</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

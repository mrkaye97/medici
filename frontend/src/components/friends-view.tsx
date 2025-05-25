import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/api/client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AddFriendModal } from "@/components/add-friend-modal";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, X, UserPlus, Clock, LogOut } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "./ui/separator";

export const FriendsView = () => {
  const { memberId, createAuthHeader, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("friends");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: friendsRaw, isLoading: isFriendsLoading } = apiClient.useQuery(
    "get",
    "/api/members/{member_id}/friends",
    {
      params: {
        path: { member_id: memberId || "" },
      },
      headers: createAuthHeader(),
    },
    {
      enabled: !!memberId,
    },
  );

  const { data: friendRequestsRaw, isLoading: isFriendRequestsLoading } =
    apiClient.useQuery(
      "get",
      "/api/members/{member_id}/friend-requests",
      {
        params: {
          path: { member_id: memberId || "" },
        },
        headers: createAuthHeader(),
      },
      {
        enabled: !!memberId,
      },
    );

  const { mutate: acceptFriendRequest, isPending: isAccepting } =
    apiClient.useMutation(
      "post",
      "/api/members/{inviting_member_id}/friend-requests/{invitee_member_id}/accept",
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ["get", "/api/members/{member_id}/friend-requests"],
          });
          queryClient.invalidateQueries({
            queryKey: ["get", "/api/members/{member_id}/friends"],
          });
        },
      },
    );

  const { mutate: deleteFriendRequest, isPending: isDeleting } =
    apiClient.useMutation(
      "delete",
      "/api/members/{inviting_member_id}/friend-requests/{invitee_member_id}",
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey: ["get", "/api/members/{member_id}/friend-requests"],
          });
        },
      },
    );

  const { data: member } = apiClient.useQuery(
    "get",
    "/api/members/{member_id}",
    {
      params: { path: { member_id: memberId || "" } },
      headers: createAuthHeader(),
    },
    {
      enabled: !!memberId,
    },
  );

  const email = member?.email;
  const name = `${member?.first_name} ${member?.last_name}`;

  const friends = friendsRaw || [];
  const friendRequests = friendRequestsRaw || [];
  const isLoading = isFriendsLoading || isFriendRequestsLoading;

  const inboundRequests = friendRequests.filter(
    (r) => r.direction === "inbound",
  );
  const outboundRequests = friendRequests.filter(
    (r) => r.direction === "outbound",
  );
  const pendingCount = inboundRequests.length;
  const waitingOutboundCount = outboundRequests.length;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <Card className="shadow-sm bg-white border rounded-lg">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-semibold">Social</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add Friend</span>
          </Button>
        </div>
        <CardDescription className="text-muted-foreground">
          Manage your friends and requests
        </CardDescription>
      </CardHeader>

      <Tabs
        defaultValue="friends"
        className="w-full"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <div className="px-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="friends">
              Friends ({friends.length})
            </TabsTrigger>
            <TabsTrigger value="requests" className="relative">
              Requests
              {pendingCount > 0 && (
                <Badge
                  variant="default"
                  className="ml-2 px-1.5 py-0.5 text-xs absolute -top-1 -right-1 bg-red-400"
                >
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="me">Me</TabsTrigger>{" "}
          </TabsList>
        </div>

        <TabsContent value="friends" className="mt-0 pt-2">
          <CardContent className="space-y-1 pb-2">
            {friends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="bg-muted rounded-full p-3 mb-3">
                  <UserPlus className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-3">
                  No friends added yet
                </p>
                <Button variant="outline" onClick={() => setIsModalOpen(true)}>
                  Add your first friend
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {friends.map((friend) => (
                  <motion.div
                    key={friend.id}
                    className="flex items-center justify-between py-3 px-1"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {friend.first_name} {friend.last_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {friend.email}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </TabsContent>

        <TabsContent value="requests" className="mt-0 pt-2">
          <CardContent className="space-y-4 pb-2">
            {friendRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="bg-muted rounded-full p-3 mb-3">
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                  No pending friend requests
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {inboundRequests.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center">
                      <span>Received Requests</span>
                      <Badge variant="outline" className="ml-2">
                        {inboundRequests.length}
                      </Badge>
                    </h3>
                    <div className="divide-y divide-gray-100 rounded-md border">
                      {inboundRequests.map((request) => (
                        <motion.div
                          key={request.member.id}
                          className="flex items-center justify-between py-3 px-3"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {request.member.first_name}{" "}
                                {request.member.last_name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {request.member.email}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={isDeleting}
                              onClick={() => {
                                deleteFriendRequest({
                                  params: {
                                    path: {
                                      inviting_member_id:
                                        request.member.id || "",
                                      invitee_member_id: memberId || "",
                                    },
                                  },
                                  headers: createAuthHeader(),
                                });
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              className="h-8 w-8 rounded-full bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-700 border border-green-200"
                              onClick={() => {
                                acceptFriendRequest({
                                  params: {
                                    path: {
                                      invitee_member_id: memberId || "",
                                      inviting_member_id: request.member.id,
                                    },
                                  },
                                  headers: createAuthHeader(),
                                });
                              }}
                              disabled={isAccepting}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {outboundRequests.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center">
                      <span>Sent Requests</span>
                      <Badge variant="outline" className="ml-2">
                        {outboundRequests.length}
                      </Badge>
                    </h3>
                    <div className="divide-y divide-gray-100 rounded-md border">
                      {outboundRequests.map((request) => (
                        <motion.div
                          key={request.member.id}
                          className="flex items-center justify-between py-3 px-3"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {request.member.first_name}{" "}
                                {request.member.last_name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {request.member.email}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                deleteFriendRequest({
                                  params: {
                                    path: {
                                      inviting_member_id: memberId || "",
                                      invitee_member_id:
                                        request.member.id || "",
                                    },
                                  },
                                  headers: createAuthHeader(),
                                });
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </TabsContent>

        <TabsContent value="me" className="mt-0 pt-2">
          <CardContent className="pb-2 flex flex-col">
            <div className="flex flex-row items-center h-12 flex-shrink-0">
              <p>{name}</p>
              <Separator orientation="vertical" className="mx-2 h-6" />
              <p>{email}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                logout();
              }}
              className="justify-center py-0 flex-shrink-0"
            >
              Log Out
              <LogOut className="size-4" />
            </Button>
          </CardContent>
        </TabsContent>
      </Tabs>

      <CardFooter className="pt-1 pb-3 px-6 flex justify-between">
        <div className="text-xs text-muted-foreground">
          {friends.length} {friends.length === 1 ? "friend" : "friends"}
          {pendingCount > 0 ? (
            <>
              {" • "}
              <span className="text-amber-600 font-medium">
                {pendingCount} pending
              </span>
            </>
          ) : (
            " 0 pending"
          )}
          {waitingOutboundCount > 0 ? (
            <>
              {" • "}
              <span className="text-cyan-600 font-medium">
                {waitingOutboundCount} waiting for reply
              </span>
            </>
          ) : (
            " 0 waiting"
          )}
        </div>
      </CardFooter>

      <AddFriendModal isOpen={isModalOpen} setIsOpen={setIsModalOpen} />
    </Card>
  );
};

import { errorMessage } from "@/api/client"
import { initials, round } from "@/components/lib/format"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { usePool } from "@/hooks/use-pool"
import { UserMinus, UserRoundPlus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

/** Even split in hundredths of a percent, with any leftover going to
 * `remainderTo` so it adds up to exactly 100 (same rule as the server). */
const evenSplit = (memberIds: string[], remainderTo: string) => {
  const per = Math.floor(10000 / memberIds.length)
  const leftover = 10000 - per * memberIds.length
  const remainderIndex = Math.max(memberIds.indexOf(remainderTo), 0)

  return Object.fromEntries(
    memberIds.map((id, i) => [
      id,
      String((per + (i === remainderIndex ? leftover : 0)) / 100),
    ])
  )
}

export const MembersPane = ({
  poolId,
  memberId,
}: {
  poolId: string
  memberId: string
}) => {
  const { members, details, mutations, friendsEligibleToAdd } = usePool({
    poolId,
  })

  // Unsaved split edits, keyed by member ID. Kept as strings so a field can
  // be empty mid-edit. `null` means nothing has been changed.
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!details) {
    return null
  }

  const isAdmin = details.role === "ADMIN"
  const sortedMembers = [...members].sort((a, b) =>
    a.member.first_name.localeCompare(b.member.first_name)
  )

  const savedSplits = Object.fromEntries(
    members.map(m => [
      m.member.id,
      String(m.pool_membership.default_split_percentage),
    ])
  )
  const shownSplits = draft ?? savedSplits

  const parsed = members.map(m => ({
    member_id: m.member.id,
    split_percentage: Number(shownSplits[m.member.id]),
  }))
  const allValid = parsed.every(
    p =>
      shownSplits[p.member_id]?.trim() !== "" &&
      Number.isFinite(p.split_percentage) &&
      p.split_percentage >= 0 &&
      p.split_percentage <= 100
  )
  const total = parsed.reduce(
    (sum, p) =>
      sum + (Number.isFinite(p.split_percentage) ? p.split_percentage : 0),
    0
  )
  const totalIsValid = Math.abs(total - 100) <= 0.011
  const canSave = draft !== null && allValid && totalIsValid

  const run = async (
    action: () => Promise<void>,
    fallback: string,
    success: string
  ) => {
    setError(null)
    try {
      await action()
      toast.success(success)
    } catch (e) {
      setError(errorMessage(e, fallback))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground font-semibold">Members</h3>
        {isAdmin && members.length > 1 && (
          <Button
            size="sm"
            variant="ghost"
            className="text-xs"
            onClick={() => {
              setError(null)
              setDraft(
                evenSplit(
                  sortedMembers.map(m => m.member.id),
                  memberId
                )
              )
            }}
          >
            Split evenly
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        {members.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No members yet
          </p>
        ) : (
          sortedMembers.map(member => (
            <Card key={member.member.id} className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                    <span className="text-xs font-medium">
                      {initials(
                        member.member.first_name,
                        member.member.last_name
                      )}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {member.member.first_name} {member.member.last_name}
                      {member.member.id === memberId && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          You
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground truncate text-xs">
                      {member.member.email}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-row items-center justify-end gap-x-2">
                  {isAdmin && member.member.id !== memberId && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger
                          className="text-destructive hover:text-destructive h-8 w-8 p-0 hover:cursor-pointer disabled:opacity-50"
                          disabled={
                            mutations.isAddPending ||
                            mutations.isRemovePending ||
                            draft !== null
                          }
                          onClick={() =>
                            run(
                              async () => {
                                await mutations.removeFriend(member.member.id)
                              },
                              `Couldn't remove ${member.member.first_name}`,
                              `Removed ${member.member.first_name} from ${details.name}`
                            )
                          }
                          aria-label={`Remove ${member.member.first_name} from pool`}
                        >
                          <UserMinus className="h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">
                            {draft !== null
                              ? "Save or reset your split changes first"
                              : `Remove ${member.member.first_name} from pool. They need to be settled up first.`}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {isAdmin ? (
                    <div className="flex flex-col items-start gap-1">
                      <Label
                        htmlFor={`split-${member.member.id}`}
                        className="text-xs"
                      >
                        Split %
                      </Label>
                      <Input
                        id={`split-${member.member.id}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={100}
                        step={0.01}
                        className="max-w-20"
                        value={shownSplits[member.member.id] ?? ""}
                        onChange={e => {
                          const value = e.target.value
                          setDraft(prev => ({
                            ...(prev ?? savedSplits),
                            [member.member.id]: value,
                          }))
                        }}
                      />
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      {member.pool_membership.default_split_percentage}%
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {isAdmin && draft !== null && (
        <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
          <p
            className={`text-sm font-medium ${totalIsValid && allValid ? "text-success" : "text-destructive"}`}
          >
            Total: {round(total)}%
            {!allValid
              ? " · each split must be 0–100"
              : !totalIsValid
                ? ` · ${total < 100 ? `${round(100 - total)}% left to assign` : `${round(total - 100)}% over`}`
                : ""}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDraft(null)
                setError(null)
              }}
            >
              Reset
            </Button>
            <Button
              size="sm"
              disabled={!canSave || mutations.isModifyDefaultSplitPending}
              onClick={() =>
                run(
                  async () => {
                    await mutations.modifyDefaultSplit(parsed)
                    setDraft(null)
                  },
                  "Couldn't save the splits",
                  "Default splits saved"
                )
              }
            >
              {mutations.isModifyDefaultSplitPending
                ? "Saving..."
                : "Save splits"}
            </Button>
          </div>
        </div>
      )}

      {isAdmin && friendsEligibleToAdd.length > 0 && (
        <>
          <div className="pt-4">
            <h4 className="text-muted-foreground mb-3 text-sm font-medium">
              Add Friends to Pool
            </h4>
            <div className="space-y-2">
              {friendsEligibleToAdd.map(friend => (
                <Card key={friend.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {friend.first_name} {friend.last_name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {friend.email}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-primary hover:text-primary h-8 w-8 p-0"
                      disabled={
                        mutations.isAddPending ||
                        mutations.isRemovePending ||
                        draft !== null
                      }
                      aria-label={`Add ${friend.first_name} to pool`}
                      onClick={() =>
                        run(
                          async () => {
                            await mutations.addFriend(friend.id)
                          },
                          `Couldn't add ${friend.first_name}`,
                          `Added ${friend.first_name} to ${details.name}`
                        )
                      }
                    >
                      <UserRoundPlus className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              New members start at 0%. Adjust the splits above if they should
              share the default split.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

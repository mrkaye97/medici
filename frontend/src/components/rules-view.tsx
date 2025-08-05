import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useRules } from "@/hooks/use-rules"
import { FileText, Plus, Trash2 } from "lucide-react"
import { motion } from "motion/react"
import { useState } from "react"
import type { components } from "schema"
import { AddRuleModal } from "./add-rule-modal"
import { categoryToDisplayName, categoryToIcon } from "./expense-modals"

type ExpenseCategoryRule = components["schemas"]["ExpenseCategoryRule"]

export const RulesView = () => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { isLoading, isDeletingRule, rules, deleteRule } = useRules()

  if (isLoading) {
    return null
  }

  return (
    <>
      <div className="mb-6">
        <p className="text-muted-foreground text-sm mt-4">
          Create rules to automatically categorize expenses based on keywords
        </p>
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              Category Rules
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>New Rule</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto space-y-4">
          {rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-muted mb-4 rounded-full p-4">
                <FileText className="text-muted-foreground h-8 w-8" />
              </div>
              <p className="text-muted-foreground mb-4">
                No expense category rules created yet
              </p>
              <p className="text-muted-foreground text-sm mb-4">
                Rules help automatically categorize your expenses based on
                keywords
              </p>
              <Button variant="outline" onClick={() => setIsModalOpen(true)}>
                Create your first rule
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule: ExpenseCategoryRule, index: number) => (
                <motion.div
                  key={`${rule.category}-${rule.rule}-${index}`}
                  className="hover:bg-muted/50 flex items-center justify-between rounded-lg border px-4 py-3 transition-colors"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0">
                      {categoryToIcon({ category: rule.category, size: 4 })}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs">
                          {categoryToDisplayName({
                            category: rule.category,
                          })}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground truncate">
                        {rule.rule}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 flex-shrink-0"
                    disabled={isDeletingRule}
                    onClick={() => deleteRule(rule.rule, rule.category)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>

        <CardFooter className="border-border border-t pt-4">
          <div className="text-muted-foreground text-sm">
            {rules.length} {rules.length === 1 ? "rule" : "rules"} configured
          </div>
        </CardFooter>
      </Card>

      <AddRuleModal isOpen={isModalOpen} setIsOpen={setIsModalOpen} />
    </>
  )
}

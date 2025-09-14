"use client"

import { useWinnerToast } from "@/hooks/use-winner-toast"
import { Button } from "@/components/ui/button"

export function WinnerToastExample() {
  const { showWinnerToast, showPayoutToast, showCelebrationToast } = useWinnerToast()

  const handleWinnerToast = () => {
    showWinnerToast(100, 1)
  }

  const handlePayoutToast = () => {
    showPayoutToast(50)
  }

  const handleCelebrationToast = () => {
    showCelebrationToast("You've achieved a new milestone!")
  }

  return (
    <div className="flex gap-4 p-4">
      <Button onClick={handleWinnerToast} variant="default">
        Show Winner Toast
      </Button>
      <Button onClick={handlePayoutToast} variant="secondary">
        Show Payout Toast
      </Button>
      <Button onClick={handleCelebrationToast} variant="outline">
        Show Celebration Toast
      </Button>
    </div>
  )
}

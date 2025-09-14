"use client"

import { useWinnerToast } from "@/hooks/use-winner-toast"
import {
  WinnerToast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  WinnerIcon,
  CoinsIcon,
  SparklesIcon,
} from "@/components/ui/winner-toast"

export function WinnerToaster() {
  const { toasts } = useWinnerToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, amount, position, ...props }) {
        const getIcon = () => {
          switch (variant) {
            case "winner":
              return <WinnerIcon />
            case "payout":
              return <CoinsIcon />
            case "celebration":
              return <SparklesIcon />
            case "destructive":
              return <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center text-white text-sm font-bold">!</div>
            default:
              return <WinnerIcon />
          }
        }

        const getBackgroundEffect = () => {
          if (variant === "winner") {
            return (
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 via-amber-400/20 to-orange-400/20 animate-pulse rounded-xl" />
            )
          }
          return null
        }

        return (
          <WinnerToast key={id} variant={variant} {...props}>
            {getBackgroundEffect()}
            <div className="relative z-10 grid gap-1 flex-1">
              <div className="flex items-center gap-2">
                {getIcon()}
                <ToastTitle>{title}</ToastTitle>
              </div>
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
              {amount && (
                <div className="flex items-center gap-1 mt-2 text-sm font-semibold text-green-700">
                  <CoinsIcon className="h-4 w-4" />
                  <span>{amount} tokens</span>
                </div>
              )}
              {position && (
                <div className="flex items-center gap-1 mt-1 text-xs font-medium text-amber-700">
                  <span>Position #{position}</span>
                </div>
              )}
            </div>
            {action}
            <ToastClose />
          </WinnerToast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

import { toast } from "@/hooks/use-toast"

export const showToast = {
  success: (message: string, description?: string) => {
    toast({
      title: "✅ Success",
      description: message,
      variant: "success",
    })
  },

  error: (message: string, description?: string) => {
    toast({
      title: "❌ Error",
      description: message,
      variant: "destructive",
    })
  },

  warning: (message: string, description?: string) => {
    toast({
      title: "⚠️ Warning",
      description: message,
      variant: "warning",
    })
  },

  info: (message: string, description?: string) => {
    toast({
      title: "ℹ️ Info",
      description: message,
      variant: "default",
    })
  },

  // Utility for custom toasts
  custom: (title: string, message: string, variant: "default" | "destructive" | "success" | "warning" = "default") => {
    toast({
      title,
      description: message,
      variant,
    })
  }
} 
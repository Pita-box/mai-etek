"use client"

import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { getApiBaseUrl } from "@/lib/api-url"

const successMessage =
  "Pokud účet existuje, poslali jsme odkaz pro obnovu hesla."

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Neplatný e-mail" }),
})

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  })

  async function onSubmit(data: ForgotPasswordFormValues) {
    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: data.email }),
      })

      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(
          result?.error || "E-mail pro obnovu hesla se nepodařilo odeslat.",
        )
      }

      setMessage(successMessage)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "E-mail pro obnovu hesla se nepodařilo odeslat.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background bg-radial-gradient p-6">
      <div className="pointer-events-none absolute left-1/4 top-1/4 -z-10 h-96 w-96 rounded-full bg-primary/10 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 -z-10 h-64 w-64 rounded-full bg-primary/5 blur-[80px]" />

      <div className="glass-card glass-card-hover z-10 w-full max-w-md space-y-8 rounded-2xl p-8">
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Obnova hesla
          </h1>
          <p className="mt-2 text-sm text-muted">
            Pošli si odkaz pro nastavení nového hesla
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">
            {message}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="you@example.com"
                      {...field}
                      className="h-12 rounded-xl border-border bg-input/50 text-foreground focus-visible:ring-ring mt-2"
                    />
                  </FormControl>
                  <FormMessage className="text-destructive text-ring" />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="mt-4 h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground transition-all duration-400 hover:bg-primary/90 hover:shadow-[0_0_15px_rgba(255,31,87,0.4)]"
              disabled={isLoading}>
              {isLoading ? "Odesílám..." : "Poslat odkaz"}
            </Button>
          </form>
        </Form>

        <div className="text-center">
          <Button
            asChild
            variant="link"
            className="h-auto p-0 font-semibold text-primary hover:text-primary/80 underline">
            <Link href="/login">Zpět na přihlášení</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

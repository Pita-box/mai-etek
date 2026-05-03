'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { getApiBaseUrl } from '@/lib/api-url';
import { createClient } from '@/utils/supabase/client';

const resetPasswordSchema = z
  .object({
    password: z.string().min(6, { message: 'Heslo musí mít alespoň 6 znaků' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Hesla se neshodují',
    path: ['confirmPassword'],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

function getHashAccessToken() {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  return params.get('access_token');
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isCheckingLink, setIsCheckingLink] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    let isMounted = true;

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || session?.access_token) && isMounted) {
        setAccessToken(session?.access_token || null);
      }
    });

    async function loadRecoverySession() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');

        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token || getHashAccessToken();

        if (isMounted) {
          setAccessToken(token || null);
          if (token && (window.location.hash || code)) {
            window.history.replaceState(null, '', '/reset-password');
          }
        }
      } catch {
        if (isMounted) {
          setError('Reset odkaz je neplatný nebo vypršel.');
        }
      } finally {
        if (isMounted) {
          setIsCheckingLink(false);
        }
      }
    }

    void loadRecoverySession();

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function onSubmit(data: ResetPasswordFormValues) {
    if (!accessToken) {
      setError('Reset odkaz je neplatný nebo vypršel.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/reset-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: data.password }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || 'Heslo se nepodařilo změnit.');
      }

      setMessage('Heslo bylo úspěšně změněno.');
      await supabase.auth.signOut();
      router.push('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Heslo se nepodařilo změnit.');
    } finally {
      setIsLoading(false);
    }
  }

  const isLinkInvalid = !isCheckingLink && !accessToken;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background bg-radial-gradient p-6">
      <div className="pointer-events-none absolute left-1/4 top-1/4 -z-10 h-96 w-96 rounded-full bg-primary/10 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 -z-10 h-64 w-64 rounded-full bg-primary/5 blur-[80px]" />

      <div className="glass-card glass-card-hover z-10 w-full max-w-md space-y-8 rounded-2xl p-8">
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight text-foreground">Nové heslo</h1>
          <p className="mt-2 text-sm text-muted">Nastav si nové heslo k účtu</p>
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

        {isCheckingLink ? (
          <div className="rounded-md border border-border bg-input/30 p-3 text-sm text-muted">
            Ověřuji reset odkaz...
          </div>
        ) : isLinkInvalid ? (
          <div className="space-y-6 text-center">
            <p className="text-sm text-muted">Požádej si o nový odkaz pro obnovu hesla.</p>
            <Button asChild className="h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground">
              <Link href="/forgot-password">Poslat nový odkaz</Link>
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Nové heslo</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                        className="h-12 rounded-xl border-border bg-input/50 text-foreground focus-visible:ring-ring"
                      />
                    </FormControl>
                    <FormMessage className="text-destructive" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Potvrď heslo</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                        className="h-12 rounded-xl border-border bg-input/50 text-foreground focus-visible:ring-ring"
                      />
                    </FormControl>
                    <FormMessage className="text-destructive" />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="mt-4 h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground transition-all duration-400 hover:bg-primary/90 hover:shadow-[0_0_15px_rgba(255,31,87,0.4)]"
                disabled={isLoading}
              >
                {isLoading ? 'Ukládám...' : 'Uložit nové heslo'}
              </Button>
            </form>
          </Form>
        )}

        <div className="text-center">
          <Button asChild variant="link" className="h-auto p-0 font-semibold text-primary hover:text-primary/80">
            <Link href="/login">Zpět na přihlášení</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

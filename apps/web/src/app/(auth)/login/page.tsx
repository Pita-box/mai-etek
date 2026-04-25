'use client';

import { useState } from 'react';
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
import { createClient } from '@/utils/supabase/client';

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        throw new Error(authError.message);
      }

      // Handle successful login
      router.push('/dashboard'); 
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background relative overflow-hidden bg-radial-gradient">
      {/* Decorative blur elements for Obsidian Glassmorphism */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none -z-10" />

      <div className="w-full max-w-md space-y-8 p-8 rounded-2xl glass-card glass-card-hover z-10">
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight text-foreground">Vítej zpět</h1>
          <p className="text-sm text-muted mt-2">Zadej svoje přihlašovací údaje pro přístup</p>
        </div>

        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
            {error}
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
                      className="bg-input/50 border-border focus-visible:ring-ring text-foreground  rounded-xl h-12"
                    />
                  </FormControl>
                  <FormMessage className="text-destructive" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Heslo</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      {...field} 
                      className="bg-input/50 border-border focus-visible:ring-ring text-foreground  rounded-xl h-12"
                    />
                  </FormControl>
                  <FormMessage className="text-destructive" />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_15px_rgba(255,31,87,0.4)] transition-all duration-400 font-bold h-12 rounded-xl mt-4"
              disabled={isLoading}
            >
              {isLoading ? 'Přihlašování...' : 'Přihlásit se'}
            </Button>
          </form>
        </Form>
        <div className="text-center mt-6">
          <p className="text-sm text-muted">
            Nemáš ještě účet?{' '}
            <Button variant="link" className="text-primary hover:text-primary/80 p-0 h-auto font-semibold" onClick={() => router.push('/register')}>
              Zaregistrovat se
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
}
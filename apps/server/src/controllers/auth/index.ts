import { Request, Response } from 'express';
import { z } from 'zod';
import { createAdminClient, getSupabaseClient } from '@maietek/db';

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const register = async (req: Request, res: Response) => {
  try {
    const parsed = authSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }
    const { email, password } = parsed.data;

    const adminAuthClient = createAdminClient();
    
    const { data, error } = await adminAuthClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ message: 'User registered successfully', user: data.user });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = authSchema.parse(req.body);
    const standardSupabase = getSupabaseClient();
    const { data, error } = await standardSupabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.status(200).json({ session: data.session, user: data.user });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

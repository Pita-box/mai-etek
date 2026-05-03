import { Request, Response } from 'express';
import { z } from 'zod';
import { createAdminClient, getSupabaseClient } from '@maietek/db';
import { sendPasswordResetEmail } from '../../services/email';
import { sendAccountSecurityTelegramNotification } from '../../services/notifications';
import { encrypt } from '../../utils/encryption';
import { getWebUrl } from '../../utils/env';

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  password: z.string().min(6),
});

const forgotPasswordMessage =
  'Pokud účet existuje, poslali jsme odkaz pro obnovu hesla.';

type RecoveryLinkProperties = {
  action_link?: string;
};

type ProfileRow = {
  full_name: string | null;
  role: 'dom' | 'sub' | 'unassigned' | null;
};

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

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const adminAuthClient = createAdminClient();
    const redirectTo = `${getWebUrl()}/reset-password`;

    const { data, error } = await adminAuthClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo,
      },
    });

    if (error) {
      console.warn('[Auth] Password reset link was not generated:', error.message);
      return res.status(200).json({ message: forgotPasswordMessage });
    }

    const properties = data.properties as RecoveryLinkProperties | undefined;
    const resetUrl = properties?.action_link;

    if (!resetUrl) {
      console.warn('[Auth] Password reset link was not generated.');
      return res.status(200).json({ message: forgotPasswordMessage });
    }

    await sendPasswordResetEmail({ to: email, resetUrl });

    return res.status(200).json({ message: forgotPasswordMessage });
  } catch (error) {
    console.error(
      '[Auth] Password reset email failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return res.status(500).json({ error: 'E-mail pro obnovu hesla se nepodařilo odeslat.' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : null;

    if (!token) {
      return res.status(401).json({ error: 'Reset odkaz je neplatný nebo vypršel.' });
    }

    const adminAuthClient = createAdminClient();
    const { data: userData, error: userError } = await adminAuthClient.auth.getUser(token);

    if (userError || !userData.user) {
      return res.status(401).json({ error: 'Reset odkaz je neplatný nebo vypršel.' });
    }

    const userId = userData.user.id;
    const { password } = parsed.data;

    const { error: updateError } = await adminAuthClient.auth.admin.updateUserById(userId, {
      password,
    });

    if (updateError) {
      throw updateError;
    }

    const encryptedPassword = encrypt(password);
    const { error: vaultError } = await adminAuthClient
      .from('user_vault')
      .upsert(
        {
          user_id: userId,
          encrypted_password: encryptedPassword,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

    if (vaultError) {
      throw vaultError;
    }

    const { data: profile } = await adminAuthClient
      .from('profiles')
      .select('full_name, role')
      .eq('id', userId)
      .maybeSingle();
    const profileRow = profile as ProfileRow | null;

    void sendAccountSecurityTelegramNotification({
      userId,
      userName: profileRow?.full_name || userData.user.email,
      userRole: profileRow?.role,
      changes: ['password'],
    }).catch((notificationError) => {
      console.error('[Auth] Telegram account security notification failed:', notificationError);
    });

    return res.status(200).json({ success: true, message: 'Heslo bylo úspěšně změněno.' });
  } catch (error) {
    console.error(
      '[Auth] Password reset failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return res.status(500).json({ error: 'Heslo se nepodařilo změnit.' });
  }
};

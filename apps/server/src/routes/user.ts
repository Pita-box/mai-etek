import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { encrypt } from '../utils/encryption';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Middleware to authenticate user via token
const requireAuth = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No authorization header' });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) return res.status(401).json({ error: 'Unauthorized' });
    
    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

router.put('/settings', requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { email, password } = req.body;

    if (!email && !password) {
      return res.status(400).json({ error: 'Email or password is required' });
    }

    const updates: any = {};
    if (email) updates.email = email;
    if (password) updates.password = password;

    // 1. Update in Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, updates);
    if (error) throw error;

    // 2. If email updated, also sync profiles (optional, but good if you store email in profile)
    // Note: Depends on if 'email' is in profiles table. If not, skip this. Let's just update auth.users.
    
    // 3. If password updated, update user_vault
    if (password) {
      const encryptedPassword = encrypt(password);
      const { error: vaultError } = await supabaseAdmin
        .from('user_vault')
        .update({ encrypted_password: encryptedPassword, updated_at: new Date() })
        .eq('user_id', userId);

      if (vaultError) {
        // If row doesn't exist, maybe insert it?
        console.error('Error updating vault:', vaultError);
        const { error: insertError } = await supabaseAdmin
          .from('user_vault')
          .insert({ user_id: userId, encrypted_password: encryptedPassword });
          
        if (insertError) throw insertError;
      }
    }

    res.json({ success: true, message: 'Nastavení bylo úspěšně uloženo.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const crypto = require('crypto');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function createSuperAdmin() {
  const email = "dom@example.com";
  const password = "SuperSecretPassword123!";

  console.log("Creating user in Auth...");
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    if (authError.message.includes('already exists')) {
       console.log("User already exists in Auth. Updating role...");
       const { data: existingUser } = await supabase.auth.admin.listUsers();
       const user = existingUser.users.find(u => u.email === email);
       if(user) {
          await updateRole(user.id, password);
       }
       return;
    } else {
       console.error("Auth Error:", authError);
       return;
    }
  }

  console.log("User created! Updating role to 'dom'...");
  await updateRole(authData.user.id, password);
}

async function updateRole(userId, plainTextPassword) {
  // Update role in profiles
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ role: 'dom' })
    .eq('id', userId);

  if (profileError) {
    console.error("Profile Update Error:", profileError);
    return;
  }
  
  // Encrypt and store password in user_vault
  const encryptionKey = process.env.VAULT_ENCRYPTION_KEY;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
  let encrypted = cipher.update(plainTextPassword, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const storedValue = iv.toString('hex') + ':' + encrypted;

  const { error: vaultError } = await supabase
    .from('user_vault')
    .upsert({ user_id: userId, encrypted_password: storedValue });

  if (vaultError) {
     console.error("Vault Update Error:", vaultError);
     return;
  }

  console.log("\n✅ SuperAdmin account successfully created/updated!");
  console.log("-----------------------------------------");
  console.log("Email:    dom@example.com");
  console.log("Password: SuperSecretPassword123!");
  console.log("Role:     DOM");
  console.log("-----------------------------------------");
}

createSuperAdmin();

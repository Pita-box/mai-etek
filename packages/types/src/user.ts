export type UserRole = 'dom' | 'sub';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  display_name?: string;
  avatar_url?: string;
  is_active: boolean;
  safe_word_active: boolean;
  telegram_chat_id?: number;
  created_at: string;
  updated_at: string;
}

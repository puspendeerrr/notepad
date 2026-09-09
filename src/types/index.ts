export type ThemePreference = 'light' | 'dark' | 'system';
export type FontFamilyPreference = 'sans' | 'mono';

export interface Note {
  id: string;
  user_id: string;
  title: string;
  slug?: string;
  content: string;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
}

export interface UserSettings {
  user_id: string;
  theme: ThemePreference;
  font_size: number;
  font_family: FontFamilyPreference;
  word_wrap: boolean;
  line_numbers: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserAccount {
  id: string;
  username: string;
  created_at: string;
  updated_at: string;
}

export interface OfflineDraft {
  noteId: string;
  userId: string;
  title: string;
  content: string;
  updatedAt: number;
  synced: boolean;
}

export type SaveStatus = 'saved' | 'saving' | 'offline';

export type Gender = 'man' | 'woman'

export type Profile = {
  id: string
  username: string
  display_name: string
  date_of_birth: string
  gender: Gender
  interested_in: Gender
  city: string | null
  bio: string | null
  avatar_path: string | null
  cosplay_characters: string[]
  fandoms: string[]
  created_at: string
  updated_at: string
}

export type DiscoverProfile = {
  id: string
  username: string
  display_name: string
  age: number
  gender: Gender
  city: string | null
  bio: string | null
  avatar_path: string | null
  cosplay_characters: string[]
  fandoms: string[]
  avatar_url?: string | null
}

export type MatchSummary = {
  match_id: string
  other_user_id: string
  username: string
  display_name: string
  age: number
  city: string | null
  bio: string | null
  avatar_path: string | null
  cosplay_characters: string[]
  fandoms: string[]
  matched_at: string
  avatar_url?: string | null
}

export type MatchContext = {
  match_id: string
  other_user_id: string
  username: string
  display_name: string
  avatar_path: string | null
  avatar_url?: string | null
}

export type ChatMessage = {
  id: string
  match_id: string
  sender_id: string
  body: string | null
  message_type: 'text' | 'image' | 'video'
  media_path: string | null
  view_once: boolean
  viewed_at: string | null
  created_at: string
  media_url?: string | null
}

export type SupportMessage = {
  id: string
  thread_id: string
  sender_id: string
  sender_role: 'user' | 'admin'
  body: string
  created_at: string
}

export type AdminDirectoryUser = {
  user_id: string
  username: string
  display_name: string
  city: string | null
  support_thread_id: string | null
}

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

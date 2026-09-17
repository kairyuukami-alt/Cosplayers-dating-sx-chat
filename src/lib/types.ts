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

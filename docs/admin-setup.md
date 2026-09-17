# Creator/admin setup

1. Create your normal Cosplay Match user account and complete the 18+ profile onboarding.
2. In Supabase Authentication, set the trusted `app_metadata` field for your account to include `{"role":"admin"}`. Do not use `user_metadata` for authorization.
3. Sign out and back in so the JWT refreshes.
4. Open `/admin/support`.

The creator console can search registered users and send platform-support messages. Those messages appear in the user's Support tab and are explicitly labeled as platform support.

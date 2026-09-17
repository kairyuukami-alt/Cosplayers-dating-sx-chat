# Privacy, moderation, and media retention

This application is designed for adults (18+) and uses private direct messaging.

## Direct messages

Direct messages are visible to the participants in the conversation. The creator/support account does not receive a silent universal inbox into private conversations.

A conversation may be reviewed by an authorized moderator only when it has been reported or otherwise escalated for a safety or legal reason. Moderation access must be logged with the moderator identity, case/report identifier, reason, and timestamp.

## Creator/support messages

The creator account may initiate a clearly labeled support/creator conversation with any registered user. Users must be able to identify that the message comes from the service creator/support account and may block ordinary dating contacts independently of support notices.

## Message deletion

Senders may delete their own messages for everyone. Deleted messages are tombstoned in the conversation and message contents/media references are removed from the live chat record.

## View-once media

Senders may mark a photo or video as view once. The recipient can request access once. After the first successful access, the live media object is scheduled for deletion. View-once cannot technically prevent screenshots, screen recording, or recording with another device.

## Temporary media backup

If Google Drive backup is enabled, the service may keep an encrypted/restricted operational backup of shared media for no longer than 72 hours, after which the backup is permanently deleted. This retention must be disclosed in the public privacy policy before launch. Do not advertise view-once media as leaving no server-side trace while this retention is enabled.

Backups must never be shared publicly, indexed, or exposed through the user-facing application.

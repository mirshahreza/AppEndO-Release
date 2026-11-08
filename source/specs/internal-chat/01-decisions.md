# Internal chat — decisions

| ID | Decision |
| --- | --- |
| D1 | **Surface:** `pageKey: my-inbox` · `kind=direct_message` · deep link `?threadId=` |
| D2 | **Storage:** Sequelize control-plane tables `base_direct_message_threads`, `base_direct_message_messages`, `base_direct_message_participant_state` |
| D3 | **DM dedup:** One thread per user pair; canonical `(participant_low_user_id, participant_high_user_id)` unique |
| D4 | **Unread:** Participant `last_read_message_id` vs latest message; inbox `attention: unread` when behind |
| D5 | **Not MSGI:** Peer chat does not write `base_user_message_dispatches` |
| D6 | **Projection:** Phase 1 reads DM rows **live** (like `message_dispatch`); optional projection later |
| D7 | **Phase 2 attachments:** Staged upload → link on send (feedback attachment service pattern) |
| D8 | **Phase 3 reply/forward:** Nullable `reply_to_message_id`, `forwarded_from_message_id` on messages |

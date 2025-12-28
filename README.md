# location-user-chat-frontend


# Location Users Chat Integration

This repository holds the Go backend that exposes the `/location-users-chat/*` REST APIs. The frontend playground that exercises those endpoints lives outside of this repo at `/Users/vikashparashar/Desktop/location-users-chat-frontend/location-users-chat`.

## Backend setup
1. Ensure the new `location_user_chat_logs` migration has been applied to your PostgreSQL instance so the backend can persist logs from every chat action.
2. Run `go test ./internal/service` or `go test ./...` inside this repo after the migration to make sure the chat services compile and log entries are recorded.
3. Start the Go server (e.g., `go run ./cmd/server`) so the API is listening on `http://localhost:8000`.

## Frontend integration
1. Open a terminal and install dependencies inside the relocated front-end folder:
   ```bash
   cd /Users/vikashparashar/Desktop/location-users-chat-frontend/location-users-chat
   npm install
   ```
2. Start the Next.js playground:
   ```bash
   npm run dev
   ```
   By default it will serve on `http://localhost:3000`.
3. In the playground's **Connection settings** card, set the API base URL to your Go server (default `http://localhost:8000`) and provide a valid `Bearer` token for authentication.
4. Use the various panels (send message, list messages, etc.) to call the Go backend. Every successful interaction will trigger the backend log helper, which writes to `location_user_chat_logs`.
5. Inspect `location_user_chat_logs` to confirm metadata (actor, action, details) is being persisted for each API call.

### API reference
Each section below mirrors a handler defined in `internal/rest/location_users_chat.go`. The playground already targets these paths, so keep your form fields aligned with the parameter/payload expectations.

- `POST /location-users-chat/messages`: send a chat message. JSON body must match `internal.LocationUserChatSendRequest` with `practice_id`, `location_id`, `message`, `message_type`, and optional recipient/attachment fields. The service will auto-fill `sender_user_id` from your token and generate a conversation; response contains the persisted `LocationUserChatMessage`.
- `GET /location-users-chat/messages`: fetch messages filtered by `practice_id`, `location_id`, `user_id`, `recipient_user_id`, `before` (RFC3339), `limit`, `include_deleted`, and `private_only`. `viewer_user_id` is derived from the token to scope reads. Response includes a slice of `LocationUserChatMessage` objects.
- `GET /location-users-chat/unread`: returns unread counts for the authenticated user. Optional query params (`location_id`, `practice_id`, `participant_user_id`) narrow the scope. Useful for showing badges or summaries.
- `POST /location-users-chat/messages/{message_id}/read`: marks the specified message as read for the authenticated user; the handler builds `LocationUserChatReadRequest` and updates read tracking.
- `DELETE /location-users-chat/messages/{message_id}`: soft deletes the message for the requesting user after the handler validates `LocationUserChatDeleteRequest`.
- `/locations/{location_id}/users` and `/practices/{practice_id}/users`: list users mapped to the specified location/practice. Returns slices of `internal.LocationUserSummary` so you can populate recipient dropdowns.

### Notes
- The frontend follows these endpoints exactly as documented by `internal/rest/location_users_chat.go`. Keep the JSON payloads and query params in sync with the structs in `internal/location_users_chat.go` (e.g., `LocationUserChatSendRequest`, `LocationUserChatListParams`).
- If you move the frontend again, update this README with the new absolute path and rerun `npm install` there.

# Testing Feedback Notification Flow

## Changes Made

1. **coordinator_app.js**: Simplified player name matching (removed regex, using direct $in match) and added detailed logging
2. **app.js**: Added detailed logging to notifications endpoint to see user lookups and notification counts
3. **PlayerTournament.jsx**: Added a dev-only "Test Feedback Notification" button that appears in development mode

## How to Test

### Step 1: Start Backend on Port 3000
```powershell
Push-Location "C:\Users\imv25\Downloads\fsd--v in\fsd-workspace\Chesshivev1.0.2"
npm start
```
**Important**: Backend must run on port 3000 for the React proxy to work!

### Step 2: Start React Frontend
```powershell
Push-Location "C:\Users\imv25\Downloads\fsd--v in\fsd-workspace\chesshive-react"
npm start
```

### Step 3: Test Feedback Notifications

#### Option A: Use the Dev Test Button (Easiest)
1. Log in as a player
2. Go to `/player/player_tournament`
3. Click the orange "🧪 Test Feedback Notification" button at the top
4. Within 5 seconds, a feedback modal should pop up automatically
5. Fill in rating and comments, click Submit

#### Option B: Coordinator Flow (Real Scenario)
1. Log in as any user
2. In browser DevTools console, promote to coordinator:
   ```javascript
   fetch('/dev/promote', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     credentials: 'include',
     body: JSON.stringify({ role: 'coordinator' })
   }).then(r => r.json()).then(console.log);
   ```
3. Go to `/coordinator/tournament_management`
4. Create a tournament or find an existing one
5. Make sure it's Ongoing or Completed (status shows in the table)
6. Click "Send Feedback Form"
7. Check backend console for logs showing notification creation
8. Log out and log back in as a player who was enrolled
9. The feedback modal should pop up automatically

### Step 4: Verify Notifications API
Run in browser console while logged in as player:
```javascript
fetch('/api/notifications', { credentials: 'include' })
  .then(r => r.json())
  .then(console.log);
```

Expected output:
```json
{
  "notifications": [
    {
      "_id": "...",
      "type": "feedback_request",
      "read": false,
      "date": "...",
      "tournamentName": "Tournament Name",
      "tournament_id": "..."
    }
  ]
}
```

## Troubleshooting

### "No notifications" or empty array
**Check in backend console:**
- "GET /api/notifications - Found user:" should show your player's name and email
- "GET /api/notifications - Found notifications:" should show count > 0

**If user not found:**
- Verify you're logged in as a player (not coordinator/organizer)
- Check that `req.session.userEmail` matches a user with `role: 'player'` in the DB

**If notifications count is 0:**
- Check MongoDB `notifications` collection directly
- Verify `user_id` in notifications matches your player's `_id` in `users` collection
- Check coordinator logs when sending feedback - should show "Notifications inserted: N"

### Coordinator can't send feedback (403)
- Run the `/dev/promote` command to set your session to coordinator
- Or log in as a user who actually has `role: 'coordinator'` in the database

### Port mismatch
- React dev server proxy points to `http://localhost:3000`
- If backend runs on 3002, edit `chesshive-react/package.json` and change `"proxy": "http://localhost:3002"`
- Restart React dev server after changing proxy

## Backend Log Examples

### When coordinator sends feedback:
```
Route hit: /api/tournaments/:id/request-feedback ID: 674... Session: {...}
Coordinator username: yourname
Database connected
Tournament found: { _id: ..., name: '...', ... }
Tournament start: 2025-12-02... Now: 2025-12-02...
Individual players: 2 Team enrollments: 0
Player names extracted from enrollments: [ 'player1', 'player2' ]
Players found in users collection: 2 Names: [ 'player1', 'player2' ]
Notifications inserted: 2
Update result: { acknowledged: true, modifiedCount: 1, ... }
```

### When player fetches notifications:
```
GET /api/notifications - Session: { email: 'player@test.com', role: 'player' }
GET /api/notifications - Found user: { _id: 674..., name: 'player1', email: 'player@test.com' }
GET /api/notifications - Found notifications: 1 [ { type: 'feedback_request', read: false, tournament: 'Test Tournament' } ]
```

## Next Steps

If everything works:
- The orange test button can be removed (it only shows in development)
- The polling and auto-popup will work in production
- Coordinator flow will create real notifications when sending feedback

If still not working, share:
- Backend console logs (especially from notifications endpoint)
- Network tab screenshot showing the notifications API response
- Whether you're logged in as player or another role

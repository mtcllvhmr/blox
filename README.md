# Ruta

A quiet 8×8 block puzzle for iPhone. Runs offline from the home screen. No accounts, no tracking, and everything is saved on the phone.

## What each file does

| File | Job |
|---|---|
| `index.html` | The page: score, board, tray of three pieces |
| `style.css` | Look and animations (palette at the top) |
| `game.js` | Rules, scoring, dragging, saving |
| `sw.js` | Service worker: keeps a copy of the app on the phone so it works offline |
| `manifest.webmanifest` | Tells the phone the app's name, icon, colours and that it is full-screen |
| `icons/` | Home-screen icons (redraw with `python3 make_icons.py`) |

## Rules and scoring

- Drag a piece from the tray onto the board. Pieces can't be rotated.
- A full row or column clears.
- Points: 1 per block placed, plus a line bonus of 10 / 30 / 60 / 100 … for 1 / 2 / 3 / 4 … lines cleared at once.
- **Streak:** each clear raises the streak. The line bonus is multiplied by it (×2, ×3 …). The streak ends after 3 placements in a row with no clear.
- Emptying the whole board adds 300.
- The game ends when none of the remaining pieces fits. A piece that can't fit anywhere is shown faded.
- The current game is saved after every move, and the best score is kept.

## Put it online (GitHub Pages, free)

1. Create a free account at github.com if you don't have one.
2. Click **+ → New repository**. Name it `ruta`, set it to **Public**, and click **Create repository**.
3. On the new repository page, click **uploading an existing file**. Drag in all the files and the `icons` folder, then click **Commit changes**.
4. Go to **Settings → Pages**. Under *Build and deployment*, set Source to **Deploy from a branch**, Branch to **main** and folder to **/ (root)**, then click **Save**.
5. Wait a minute or two. The address will be `https://<your-username>.github.io/ruta/`.

## Add it to your iPhone home screen

1. Open the address in **Safari** on the iPhone. This needs Safari, not Chrome.
2. Wait for the game to appear, and play a move so you know it has loaded fully.
3. Tap the **Share** button (square with an arrow) and choose **Add to Home Screen**. If you don't see it, scroll down the share sheet.
4. Make sure **Open as Web App** is on (if shown), then tap **Add**.
5. Open Ruta from the home screen. It runs full-screen with no browser bars.
6. To check offline play, switch on Airplane Mode and open it again.

Note: the home-screen app keeps its own storage, separate from Safari. The best score you set in Safari won't carry over. That's normal.

## Changing it later

Edit the files and upload them to GitHub again. The phone shows the cached version first and fetches the new one in the background. Close and reopen the app once more to see your change. For a guaranteed clean refresh, change `VERSION` in `sw.js` (e.g. `ruta-v2`).

## Ideas for later

- Stats: games played and average score (stored the same way as the best score).

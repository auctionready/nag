# Hosting the Expo Dev Server on a VPS

For remote-device testing we run the Expo dev server on a VPS with a
fixed IP. A reverse proxy (nginx or Caddy) fronts Metro with TLS and
WebSocket upgrades; a pair of systemd **user** units keeps Metro alive
and polls GitHub every couple of minutes so pushes deploy themselves.
No ngrok, no Railway, no CI hop.

## How it works

- **`nag-expo.service`** ([`ops/nag-expo.service`](../ops/nag-expo.service))
  runs `pnpm --filter @nag/app exec expo start --dev-client --port 8081`.
  Restarts on failure.
- **`nag-deploy.timer`** ([`ops/nag-deploy.timer`](../ops/nag-deploy.timer))
  fires every two minutes. It triggers **`nag-deploy.service`**
  ([`ops/nag-deploy.service`](../ops/nag-deploy.service)), which runs
  [`ops/deploy.sh`](../ops/deploy.sh):
  1. Verify `origin/$NAG_BRANCH` exists (guards against typos).
  2. `git fetch origin $NAG_BRANCH`.
  3. Verify the target commit contains `ops/deploy.sh` (refuses to
     reset into a branch that would delete the hosting files).
  4. If HEAD moved, `git reset --hard` to the target and re-run
     `pnpm install --frozen-lockfile` _only if_ `pnpm-lock.yaml`
     changed.
  5. `systemctl --user restart nag-expo.service`.
- **Reverse proxy** in front of Metro — either nginx
  ([`ops/nginx-nag.conf`](../ops/nginx-nag.conf)) or Caddy
  ([`ops/Caddyfile`](../ops/Caddyfile)). Terminates TLS on
  `https://dev.example.com` and proxies to `localhost:8081` with the
  WebSocket upgrade Metro needs for HMR / logs.

## Prerequisites

- A Debian/Ubuntu-ish VPS with a public IP, root (sudo) access, and
  SSH in.
- A DNS `A` record for the hostname you'll use (e.g.
  `dev.mysite.com`) pointing at the VPS. If you use Cloudflare, turn
  off the orange proxy cloud for this subdomain — it interferes with
  long-lived WebSockets and the HMR pipe.
- A dev-client build of the app on the device you'll test from
  (`eas build --profile development --platform ios`).

## One-time VPS setup

### 1. Create a dedicated user (as root)

```bash
sudo useradd -m -s /bin/bash nag
sudo loginctl enable-linger nag   # user services run without an active login
```

`enable-linger` is essential — without it the user systemd instance
exits when you log out and the dev server dies with it.

Drop into the account:

```bash
sudo -iu nag
```

All the remaining steps run as `nag` unless noted.

### 2. Fix the systemd user-bus env in SSH sessions

SSH sessions opened with `sudo -iu nag` or direct key-based login
don't automatically get the env vars `systemctl --user` needs. Symptom:
`Failed to connect to bus: $DBUS_SESSION_BUS_ADDRESS and
$XDG_RUNTIME_DIR not defined`.

Add them to `~/.bashrc` so every SSH login picks them up:

```bash
cat >> ~/.bashrc <<'EOF'
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"
EOF
source ~/.bashrc
systemctl --user status   # should connect, not error
```

### 3. Bump kernel file-watch limits (as root)

Metro watches the entire monorepo — defaults of 8192 inotify watches
are nowhere near enough and it fails with
`Error: ENOSPC: System limit for number of file watchers reached`.

```bash
sudo tee /etc/sysctl.d/60-nag-watches.conf >/dev/null <<'EOF'
fs.inotify.max_user_watches = 524288
fs.inotify.max_user_instances = 512
EOF
sudo sysctl --system
```

### 4. Install Node, pnpm, git, Watchman

Use any Node version manager. [mise](https://mise.jdx.dev/) is quick:

```bash
curl https://mise.run | sh
echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc
exec bash
mise use -g node@24
corepack enable
corepack prepare pnpm@10.33.0 --activate
```

Watchman keeps Metro's file-watch cache warm on Linux; without it the
bundler is visibly slower and re-transforms more often:

```bash
sudo apt install -y watchman git
```

Verify: `node -v`, `pnpm -v`, `git --version`, `watchman version`.

### 5. Set up a GitHub deploy key

The repo is private, so HTTPS clones prompt for a username and fail
non-interactively. Give the VPS a read-only SSH deploy key instead:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/nag-deploy -C nag-vps -N ''
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/nag-deploy
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
EOF
chmod 600 ~/.ssh/config
cat ~/.ssh/nag-deploy.pub
```

Copy the printed public key into
**GitHub → the repo → Settings → Deploy keys → Add deploy key**
(read-only is fine). Smoke-test:

```bash
ssh -T git@github.com   # expect: "Hi christensena/nag! You've successfully authenticated..."
```

### 6. Clone the repo

```bash
git clone git@github.com:christensena/nag.git ~/nag
cd ~/nag
pnpm install --frozen-lockfile
```

### 7. Drop in host-local config

```bash
mkdir -p ~/.config/nag
cp ~/nag/ops/expo.env.example   ~/.config/nag/expo.env
cp ~/nag/ops/deploy.env.example ~/.config/nag/deploy.env
$EDITOR ~/.config/nag/expo.env     # set REACT_NATIVE_PACKAGER_HOSTNAME
$EDITOR ~/.config/nag/deploy.env   # set NAG_BRANCH
```

> `REACT_NATIVE_PACKAGER_HOSTNAME` **must** match the public hostname
> you'll serve the proxy from. Without it Metro tells the dev client
> to fetch bundles from `localhost:8081`, which the device can't
> reach. Do **not** set `CI=1` — it puts Metro in non-watch mode and
> kills the bundler cache.

### 8. Install and start the systemd user units

```bash
mkdir -p ~/.config/systemd/user
ln -sf ~/nag/ops/nag-expo.service    ~/.config/systemd/user/
ln -sf ~/nag/ops/nag-deploy.service  ~/.config/systemd/user/
ln -sf ~/nag/ops/nag-deploy.timer    ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now nag-expo.service
systemctl --user enable --now nag-deploy.timer
systemctl --user list-unit-files 'nag-*'   # all three should say "enabled"
```

Tail the logs:

```bash
journalctl --user -u nag-expo.service -f
journalctl --user -u nag-deploy.service -f
```

### 9. Put a reverse proxy in front of Metro (as root)

Metro listens on plain HTTP `localhost:8081`. Pick one proxy to
terminate TLS and handle WebSocket upgrades. **Use nginx if it's
already running on the VPS** — Caddy can't coexist on 80/443.

#### Option A: nginx (recommended if already installed)

The template is HTTP-only on purpose — `certbot --nginx` upgrades it
to HTTPS on 443 and adds the redirect from 80 automatically. If you
ship a TLS block before running certbot, `nginx -t` fails (the cert
file doesn't exist yet) and certbot refuses to run.

Before you touch nginx, snapshot the config for safety:

```bash
sudo tar -czf ~/nginx-backup-$(date +%F).tgz /etc/nginx
```

Install certbot (if needed) and drop in the vhost:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo cp /home/nag/nag/ops/nginx-nag.conf /etc/nginx/sites-available/nag.conf
sudo sed -i 's/dev\.example\.com/your.real.hostname/g' /etc/nginx/sites-available/nag.conf
sudo ln -sf /etc/nginx/sites-available/nag.conf /etc/nginx/sites-enabled/nag.conf
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your.real.hostname   # pass ONLY the new hostname
sudo nginx -t && sudo systemctl reload nginx
curl -I https://your.real.hostname           # sanity-check
```

The vhost matches by `server_name`, so existing sites on other
hostnames are unaffected.

#### Option B: Caddy (clean VPS, nothing on 80/443 yet)

Install from **apt**, not snap — third-party snap Caddys use different
config paths and sometimes have port-binding issues inside snap
confinement:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
sudo cp /home/nag/nag/ops/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/dev\.example\.com/your.real.hostname/' /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
```

First request to `https://your.real.hostname` provisions the
Let's Encrypt cert automatically.

> Don't install Caddy alongside an existing nginx on the same box —
> they fight over ports 80/443 and Caddy fails to start with
> `bind: address already in use`.

### 10. Connect a device

1. Open the dev-client build on the device.
2. Choose **Enter URL manually** and type `https://your.real.hostname`
   (no port — the proxy serves 443).
3. Metro bundles and the app loads. First bundle is slow (cold
   cache); incremental rebuilds are quick.

## Day-to-day

- **Deploys happen automatically** within ~2 minutes of a push to
  `NAG_BRANCH`. Follow `journalctl --user -u nag-deploy.service -f`
  if you want to watch.
- **Force a deploy**: `systemctl --user start nag-deploy.service`.
- **Restart Metro** (e.g. after an env change):
  `systemctl --user restart nag-expo.service`.
- **Stop the dev server**: `systemctl --user stop nag-expo.service`.
- **Switch branches**: edit `~/.config/nag/deploy.env`, then
  `systemctl --user restart nag-deploy.timer`.
- **From a non-`nag` shell** (e.g. your regular sudo account):
  `sudo -u nag XDG_RUNTIME_DIR=/run/user/$(id -u nag) \
systemctl --user --machine=nag@ ...`.

## Troubleshooting

### `Failed to connect to bus: $DBUS_SESSION_BUS_ADDRESS … not defined`

You're logged in as `nag` but missed step 2. Add the env vars to
`~/.bashrc` as shown there, or export them in the current shell.

### Unit files show `STATE=bad`

Run `systemd-analyze --user verify ~/nag/ops/nag-expo.service` to see
the parse error. In this project it's usually either a stale
reference to a system-only target (fixed on the current branch) or a
`git reset` having wiped `ops/` (see next entry).

### `nag-deploy.service` exits 128, or `systemctl restart nag-expo` says "Unit not found"

Almost always `NAG_BRANCH` misconfiguration — a typo or pointing at a
branch that doesn't carry `ops/`. `deploy.sh` guards both cases with
a clear error, but if you got here before the guards landed, your
checkout may have been reset to a branch that no longer contains the
systemd unit files. Fix:

```bash
grep NAG_BRANCH ~/.config/nag/deploy.env    # does it name a real branch?
cd ~/nag && git fetch origin "$BRANCH" && git reset --hard "origin/$BRANCH"
systemctl --user daemon-reload
systemctl --user restart nag-expo.service
```

### `ENOSPC: System limit for number of file watchers reached`

Kernel inotify limit still at the 8192 default. Redo step 3.

### "Could not connect to development server" with a `:8081` URL

Metro's manifest is still advertising `localhost:8081` (or the
private IP) instead of the public hostname. Set
`REACT_NATIVE_PACKAGER_HOSTNAME` in `~/.config/nag/expo.env` and
restart the expo service. Verify by curling the manifest and
confirming `hostUri` / `launchAsset.url` use your public hostname:

```bash
curl -sS https://your.real.hostname/ | head -100
```

### Bundling is slow even on rebuilds

- Is `CI=1` set in `~/.config/nag/expo.env`? Remove it — it disables
  Metro's watcher, so each request cold-transforms everything.
- Is Watchman installed and working? `watchman version` should
  succeed, and Metro's startup log should not say "fallback file
  watching".
- Is the VPS CPU-starved? First bundles are transformation-heavy; a
  1 vCPU box is visibly slow on the first load but fine after.

### `libatk-1.0.so.0: cannot open shared object file`

React Native DevTools tries to spin up an Electron-ish UI on first
connection and the headless VPS lacks the GTK libs. **Harmless** —
Metro still serves bundles. Silence it with:

```bash
sudo apt install -y libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libxkbcommon0 libnss3 libxcomposite1 libxdamage1 libxrandr2 \
  libgbm1 libpango-1.0-0 libasound2 libgtk-3-0
```

## Caveats

- **Dev server, not production.** Ship real builds via EAS.
- **Hard reset is destructive.** The deploy script runs
  `git reset --hard`, so never keep uncommitted work in the VPS
  checkout. Host-specific config lives in `~/.config/nag/`, outside
  the repo, so it's safe from resets.
- **Metro restarts per deploy.** Connected dev clients reconnect
  automatically, but in-flight debugger sessions drop.
- **Webhooks (alternative).** If the 2-minute polling lag matters,
  put a tiny webhook receiver (e.g.
  [`webhook`](https://github.com/adnanh/webhook)) behind the reverse
  proxy that triggers `systemctl --user start nag-deploy.service` on
  GitHub `push` events. Polling is simpler and doesn't require
  sharing a secret with GitHub.

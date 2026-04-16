# Hosting the Expo Dev Server on a VPS

For remote-device testing we run the Expo dev server on a VPS with a
fixed IP. [Caddy](https://caddyserver.com/) fronts Metro with TLS and
WebSocket upgrades; a pair of systemd **user** units keeps Metro alive
and polls GitHub every couple of minutes so pushes to `main` deploy
themselves. No ngrok, no Railway, no CI hop.

## How it works

- **`nag-expo.service`** ([`ops/nag-expo.service`](../ops/nag-expo.service))
  runs `pnpm --filter @nag/app exec expo start --dev-client --port 8081`.
  Restarts on failure.
- **`nag-deploy.timer`** ([`ops/nag-deploy.timer`](../ops/nag-deploy.timer))
  fires every two minutes. It triggers **`nag-deploy.service`**
  ([`ops/nag-deploy.service`](../ops/nag-deploy.service)), which runs
  [`ops/deploy.sh`](../ops/deploy.sh):
  1. `git fetch origin $NAG_BRANCH`
  2. If HEAD moved, `git reset --hard` to the target and re-run
     `pnpm install --frozen-lockfile` _only if_ `pnpm-lock.yaml`
     changed.
  3. `systemctl --user restart nag-expo.service`.
- **Caddy** ([`ops/Caddyfile`](../ops/Caddyfile)) reverse-proxies
  `https://dev.example.com` to `localhost:8081` and handles the
  WebSocket upgrade Metro needs for HMR / logs.

## One-time VPS setup

Assumes a fresh Debian/Ubuntu-ish box with a public IP and a DNS
`A`-record pointing `dev.example.com` (or whatever hostname you pick)
at it.

### 1. Create a dedicated user

```bash
sudo useradd -m -s /bin/bash nag
sudo loginctl enable-linger nag   # user services run without an active login
sudo -iu nag
```

All the remaining steps run as `nag` unless noted.

### 2. Install Node, pnpm, git

Use whatever version manager you prefer. [mise](https://mise.jdx.dev/)
is quick:

```bash
curl https://mise.run | sh
echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc
exec bash
mise use -g node@24
corepack enable
corepack prepare pnpm@10.33.0 --activate
```

Verify: `node -v`, `pnpm -v`, `git --version`.

### 3. Clone the repo

```bash
git clone https://github.com/christensena/nag.git ~/nag
cd ~/nag
pnpm install --frozen-lockfile
```

If the repo is private, add a read-only deploy key:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/nag-deploy -C nag-vps -N ''
cat ~/.ssh/nag-deploy.pub   # paste into GitHub → Repo → Settings → Deploy keys
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/nag-deploy
  IdentitiesOnly yes
EOF
git remote set-url origin git@github.com:christensena/nag.git
```

### 4. Drop in config

```bash
mkdir -p ~/.config/nag
cp ~/nag/ops/expo.env.example   ~/.config/nag/expo.env
cp ~/nag/ops/deploy.env.example ~/.config/nag/deploy.env
$EDITOR ~/.config/nag/expo.env     # set REACT_NATIVE_PACKAGER_HOSTNAME
$EDITOR ~/.config/nag/deploy.env   # pick NAG_BRANCH
```

### 5. Install and start the user units

```bash
mkdir -p ~/.config/systemd/user
ln -sf ~/nag/ops/nag-expo.service    ~/.config/systemd/user/
ln -sf ~/nag/ops/nag-deploy.service  ~/.config/systemd/user/
ln -sf ~/nag/ops/nag-deploy.timer    ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now nag-expo.service
systemctl --user enable --now nag-deploy.timer
```

Tail the logs:

```bash
journalctl --user -u nag-expo.service -f
journalctl --user -u nag-deploy.service -f
```

### 6. Install Caddy (as root)

```bash
sudo apt install -y caddy
sudo cp /home/nag/nag/ops/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/dev\.example\.com/your.real.hostname/' /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

First request to `https://your.real.hostname` provisions the
Let's Encrypt cert automatically.

### 7. Connect a device

1. Install a dev-client build on the device
   (`eas build --profile development --platform ios`, then install the
   resulting `.ipa`).
2. Open the dev client, choose **Enter URL manually**, and type
   `https://your.real.hostname` (no port — Caddy serves 443).
3. Metro bundles and the app loads.

## Day-to-day

- **Deploys happen automatically** within ~2 minutes of a push to
  `NAG_BRANCH`. Follow `journalctl --user -u nag-deploy.service -f` if
  you want to watch.
- **Force a deploy**: `systemctl --user start nag-deploy.service`.
- **Stop the dev server**: `systemctl --user stop nag-expo.service`.
- **Switch branches**: edit `~/.config/nag/deploy.env`, then
  `systemctl --user restart nag-deploy.timer`.

## Caveats

- **Dev server, not production.** Ship real builds via EAS.
- **Hard reset is destructive.** The deploy script runs
  `git reset --hard`, so never keep uncommitted work in the VPS
  checkout. Host-specific config lives in `~/.config/nag/`, outside
  the repo.
- **Metro restarts per deploy.** Connected dev clients reconnect
  automatically, but in-flight debugger sessions drop.
- **Watcher limits.** Metro watches the whole workspace. If you see
  `ENOSPC` / `inotify` errors, bump the kernel limit:
  ```bash
  echo 'fs.inotify.max_user_watches = 524288' | sudo tee /etc/sysctl.d/60-nag-watches.conf
  sudo sysctl --system
  ```
- **Webhooks (alternative).** If the 2-minute polling lag matters, put
  a tiny webhook receiver (e.g.
  [`webhook`](https://github.com/adnanh/webhook)) behind Caddy that
  triggers `systemctl --user start nag-deploy.service` on GitHub
  `push` events. Polling is simpler and doesn't require sharing a
  secret with GitHub.

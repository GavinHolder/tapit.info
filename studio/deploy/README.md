# Deploying TapIt Studio (Portainer, HTTPS, MikroTik)

Studio runs as two containers: **studio** (the app, never exposed directly) and **caddy** (the HTTPS front door). Data lives in a Docker volume, so rebuilding or restarting never loses accounts, messages or uploads.

This setup was built and tested with Docker here: HTTPS, secure login cookie, login lockout behind the proxy, IP allow-list, data surviving a restart, and Finalize writing handoffs. It has **not** been run on your VM, MikroTik or Portainer, so follow the checks at the bottom.

## 1. Get the files onto the VM

```
git clone <your repo> /opt/tapit
cd /opt/tapit && git checkout claude/nifty-lamport-2rxnx1   # or main once merged
```

The `planning/` folder in that clone is what Studio reads and writes (flows, questions, decisions, finalized handoffs). Commit and push handoffs from there when you want them in git.

Give the container permission to write to it (it runs as a normal user, id 1000):

```
sudo chown -R 1000:1000 /opt/tapit/planning
```

## 2. Settings

Copy `studio/deploy/stack.env.example` to `studio/.env` and edit it, or paste the lines into the Portainer stack's **Environment variables**. The important ones:

| Variable | What |
|---|---|
| `STUDIO_DOMAIN` / `STUDIO_PUBLIC_URL` | The address your client opens, for example `studio.example.com` |
| `STUDIO_OWNER_EMAIL` / `STUDIO_OWNER_PASSWORD` | Your developer login. Created once, on the first start with an empty database. Remove them afterwards. |
| `STUDIO_ALLOW_IPS` | Optional. Only these addresses may reach the site. Use the client's fixed IP plus yours. Login is still required. |
| `CADDYFILE` | `Caddyfile` (real domain, free automatic certificate) or `Caddyfile.internal` (no domain, certificate Caddy makes itself) |
| `PLANNING_HOST_DIR` | Folder with the planning files, default `../planning` relative to the compose file |

## 3. Start it

**Portainer:** Stacks, Add stack, Repository. Repository URL is your repo, compose path is `studio/docker-compose.yml`, add the environment variables, Deploy. If the stack cannot see the `planning` folder (Portainer clones to its own place), set `PLANNING_HOST_DIR=/opt/tapit/planning` to the clone from step 1.

**Command line:** `cd /opt/tapit/studio && docker compose up -d --build`

## 4. MikroTik

Forward only HTTPS (and HTTP once, for the certificate). Replace `<VM-IP>` with the VM's address and `ether1` with your internet interface (or use your WAN interface list).

```
/ip firewall nat add chain=dstnat action=dst-nat protocol=tcp dst-port=443 \
    in-interface=ether1 to-addresses=<VM-IP> to-ports=443 comment="TapIt Studio HTTPS"
/ip firewall nat add chain=dstnat action=dst-nat protocol=tcp dst-port=80 \
    in-interface=ether1 to-addresses=<VM-IP> to-ports=80 comment="TapIt Studio cert (HTTP)"
```

If your forward chain drops by default, allow the forwarded traffic **above** the drop rule:

```
/ip firewall filter add chain=forward action=accept protocol=tcp dst-address=<VM-IP> \
    dst-port=80,443 connection-nat-state=dstnat comment="TapIt Studio" place-before=[find where action=drop and chain=forward]
```

Check the `place-before` rule exists on your router first; adjust to your own rule order.

Better still, restrict by source at the router as well, so strangers never reach the VM:

```
/ip firewall address-list add list=studio-allowed address=<client-fixed-ip>
/ip firewall address-list add list=studio-allowed address=<your-ip>
```

and add `src-address-list=studio-allowed` to the two accept rules.

**No fixed IP at home?** `/ip cloud set ddns-enabled=yes` gives a name like `xxxx.sn.mynetname.net`. Point a CNAME from your domain to it.

**If the client has a fixed IP:** use `STUDIO_ALLOW_IPS` plus the router list. This is the simplest safe setup.

**If not:** prefer a VPN. MikroTik supports WireGuard. Give the client a WireGuard profile and do not forward 443 at all. Use `CADDYFILE=Caddyfile.internal` and reach Studio on the VM's private address.

## 5. HTTPS choices

- **Real domain (default Caddyfile):** Caddy gets a free certificate from Let's Encrypt and renews it. Needs ports 80 and 443 reachable and the domain pointing at your public IP. This contacts Let's Encrypt at runtime, which is the one outside service involved.
- **No domain, or fully internal (`Caddyfile.internal`):** Caddy issues its own certificate. Browsers warn once. To remove the warning, install Caddy's root certificate on the client's device: `docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt .` and double-click it on the device.

## 6. Back up and update

- **Back up the data volume** (accounts, messages, uploads) regularly:
  ```
  docker run --rm -v studio_studio-data:/data -v $PWD:/backup alpine tar czf /backup/studio-data-$(date +%F).tgz -C /data .
  ```
  The volume name starts with the project folder name; check with `docker volume ls`.
- The `planning/` folder is in git. Commit it.
- **Update:** `cd /opt/tapit && git pull && cd studio && docker compose up -d --build`. In Portainer: pull and redeploy the stack.

## 7. Checks after deploying

1. `https://<your domain>/api/health` shows `{"ok":true,...}`.
2. `http://<your domain>` redirects to https.
3. Sign in as the developer. The top bar shows the version.
4. From a phone on mobile data (not your Wi-Fi) the site opens. From a device **not** on the allow-list you get "403".
5. Open Inbox, answer a question as a test client (invite one in Team), then Finalize and confirm a folder appears in `planning/handoffs/`.
6. Restart the stack. Everything is still there.

## Security notes

- Studio is not exposed directly. Only Caddy publishes ports.
- Five wrong passwords lock that visitor out for a while (per address, via the proxy).
- Uploads are images only and are never served as web pages.
- Keep the owner password out of git. Use the stack's environment variables.
- Pen-test before any real business data goes in. Nothing here has been independently tested.

# TapIt Studio on a VM: from a blank server to your client signed in

This guide takes you from an empty Ubuntu VM to Studio running over HTTPS with your client connected. Follow the steps in order. Each one says how to check it worked.

What was tested: the installer, the containers, HTTPS, login, backups and updates were run in Docker in a test environment. Your VM, router and DNS were not, so every step has a check.

## What you need

- A VM running **Ubuntu Server 22.04 or 24.04 LTS** (Debian 12 also works). 2 CPU cores, 2 GB RAM (4 GB is comfortable), 20 GB disk. It needs internet access to download Docker and build the app.
- A way to log into it with SSH (a user that can use `sudo`).
- Your router (MikroTik) if the client will connect from outside your network.
- Optional but best: a **domain name** you control (for example `studio.yourcompany.co.za`) so the certificate is automatic and the client gets no browser warning.

## 1. Prepare the VM

1. Create the VM with a **bridged** network adapter so it gets an address on your network.
2. Give it a fixed address: either set a static IP in Ubuntu, or (easier) make a **DHCP reservation** for the VM's MAC address on the MikroTik: IP, DHCP Server, Leases, right-click the lease, Make Static. Write the address down. Below it is called `<VM-IP>`.
3. Log in with SSH and update:
   ```
   sudo apt update && sudo apt -y upgrade
   sudo apt -y install unzip
   ```
**Check:** from your PC, `ssh youruser@<VM-IP>` works.

## 2. Put the package on the VM

On your Windows PC, in PowerShell, in the folder holding `tapit-studio-deploy.zip`:
```
scp tapit-studio-deploy.zip youruser@<VM-IP>:~/
```
Then on the VM:
```
sudo mkdir -p /opt/tapit
sudo unzip -o ~/tapit-studio-deploy.zip -d /opt/tapit
cd /opt/tapit
ls
```
**Check:** `ls` shows two folders, `studio` and `planning`.

## 3. Run the installer

```
cd /opt/tapit
sudo bash studio/deploy/setup.sh
```
It installs Docker if needed, asks a few questions, builds Studio and starts it. The first build takes a few minutes. The questions:

| Question | Answer |
|---|---|
| Domain or no domain | **1** if you have a domain pointing at your public IP (automatic free certificate). **2** to start without one (a self-made certificate, the browser warns once). You can switch later with `--reconfigure`. |
| Domain / address | The domain, or the VM's IP. |
| Your email, name, password | Your developer login. Press Enter at the password to have one generated and shown once. |
| Allowed addresses | Optional. The client's fixed IP and yours, separated by spaces, to let only them in. Press Enter to allow anyone (login is still required). |

**Check:** the installer ends with "Studio is running" and prints the address and your login.

Safe to run again. It keeps your settings unless you add `--reconfigure`.

## 4. Look at it from inside your network

Open `https://<VM-IP>` (or your domain) in a browser on your PC. With no domain you will see a certificate warning: choose Advanced, then Continue. Sign in with the login the installer printed.

**Check:** the Studio top bar shows a version number next to the logo, and the Inbox lists the client questions.

## 5. Let your client reach it from outside

Pick one of three ways. **A or B**: forward ports on the router. **C**: no forwarding at all (safest).

### A. Domain and forwarded ports (recommended when the client has no fixed IP)

1. **DNS:** create an `A` record for your domain pointing at your public IP. If your IP changes, use MikroTik's free name instead: `/ip cloud set ddns-enabled=yes`, then create a `CNAME` from your domain to the name it shows (`xxxx.sn.mynetname.net`).
2. **MikroTik:** forward ports 80 and 443 to the VM. Port 80 is only used to prove you own the domain for the certificate.
   ```
   /ip firewall nat add chain=dstnat action=dst-nat protocol=tcp dst-port=443 in-interface=ether1 to-addresses=<VM-IP> to-ports=443 comment="TapIt Studio HTTPS"
   /ip firewall nat add chain=dstnat action=dst-nat protocol=tcp dst-port=80 in-interface=ether1 to-addresses=<VM-IP> to-ports=80 comment="TapIt Studio certificate"
   ```
   Replace `ether1` with your internet-facing interface. If your forward chain drops by default, add accept rules for those two ports above the drop rule (see `studio/deploy/README.md`).
3. **Check from outside:** on a phone using mobile data (not your Wi-Fi), open `https://your-domain`. You should see the sign-in page with a padlock.
4. If the certificate does not arrive, see Troubleshooting.

### B. Only let known addresses in

If your client has a **fixed IP**, run the installer again with `--reconfigure` and enter the allowed addresses, or edit `/opt/tapit/studio/.env` (`STUDIO_ALLOW_IPS=41.1.2.3 196.2.3.4`) and run `cd /opt/tapit/studio && sudo docker compose up -d`. Anyone else sees "403". Do the same on the router with an address list for extra safety (`studio/deploy/README.md`).

### C. VPN (no ports forwarded)

Create a WireGuard server on the MikroTik and give the client a profile. They connect the VPN and open `https://<VM-IP>`. Install with option 2 (no domain). This keeps Studio completely off the internet.

## 6. Connect the client

1. In Studio open **Settings**. Under **Email connection** enter your mail server details, save, then press **Send a test email** and confirm it arrives. Adjust the wording under **Email wording and look** if you like.
2. Open **Team**, **Add a person**. Enter the client's name and email, choose **Client**, and either:
   - **Send an invite link** (tick *Also email the invitation* if email works), or
   - **Set a password now** and give them the details. They can change it with the **Password** button.
3. Send the client the address. If you used a self-made certificate and want to avoid the warning, install Caddy's certificate on their device (see `studio/deploy/README.md`, "HTTPS choices").
4. Ask the client to open the link, set a password, and start with **Inbox**: questions marked "Needed first".

**Check:** sign in as the client in a private window. They see the Inbox and Decisions, but no Flows editing, Finalize, Settings or Team.

## 7. Every day

| Task | Command (on the VM, in `/opt/tapit/studio`) |
|---|---|
| Is it running? | `sudo docker compose ps` |
| Logs | `sudo docker compose logs --tail 100 studio` |
| Restart | `sudo docker compose restart` |
| Back up now | `sudo bash deploy/backup.sh` |
| Back up every night | `sudo bash deploy/backup.sh --install-cron` |
| Restore a backup | `sudo bash deploy/restore.sh /opt/tapit-backups/studio-data-....tgz` |
| Update to a new package | Unzip the new package to `/tmp/new`, then `sudo bash deploy/update.sh /tmp/new` |

Backups land in `/opt/tapit-backups` (14 kept). **Copy them off the VM now and then.**

The planning files (flows, questions, decisions and the finalized handoffs) are in `/opt/tapit/planning`. Copy a handoff folder to your PC to give to Claude Code, or download its zip from the **Finalize** page.

### Adding and removing mockups (no update needed)

On the **Mockups** page, the developer account has **Import a mockup**: drop an `.html` file (a Claude Design `.dc.html` works) or a PNG/JPEG/GIF/WebP screenshot, name it, pick a group, and it is live for the client straight away. **Delete** removes an imported mockup for good, including its comments. The built-in mockups are only hidden, and **Restore built-in mockups** brings them back.

Imported files live in the data folder, so the nightly backup and the update script already carry them, and Finalize copies them into the handoff. Imported HTML runs inside Studio with outside requests blocked, so include fonts and images in the file itself, and only import files you made or trust.

## 8. Security checklist

- [ ] Use a long developer password. Delete the `STUDIO_OWNER_PASSWORD` line from `/opt/tapit/studio/.env` after the first start.
- [ ] Only ports 80 and 443 are forwarded (never 3100).
- [ ] `STUDIO_ALLOW_IPS` set if the client has a fixed IP.
- [ ] Nightly backup installed and a copy kept somewhere else.
- [ ] Ubuntu updates applied now and then (`sudo apt update && sudo apt -y upgrade`).
- [ ] Have the system pen-tested before real business data goes in.

## Troubleshooting

| Problem | What to do |
|---|---|
| Installer says Docker could not install | Check the VM has internet (`ping -c2 1.1.1.1`) and that `apt` works, then run it again. |
| `Studio did not answer in time` | `sudo docker compose logs --tail 80` shows why. A wrong `.env` value is the usual cause: fix it and run `sudo docker compose up -d`. |
| Browser warns about the certificate (no domain) | Expected with a self-made certificate. Continue once, or install Caddy's root certificate, or use a domain. |
| No certificate with a domain | The domain must point at your public IP, ports 80 and 443 must reach the VM, and nothing else may use them. `sudo docker compose logs caddy` shows the reason. |
| Works inside, not outside | Check the MikroTik rules, that your ISP does not block 80/443, and that you are not testing from inside your own network (some routers cannot loop back). |
| "403" for the client | Their address is not in `STUDIO_ALLOW_IPS`, or their IP changed. |
| Forgot the developer password | `cd /opt/tapit/studio && sudo docker compose exec studio node scripts/reset-password.mjs you@example.com "new long password"` |
| Need another developer or client login | In Studio, **Team**, **Add a person**. |
| Emails do not arrive | **Settings**, **Send a test email** shows the reason. Check your spam folder too. |
| Disk full | `sudo docker system prune -f`, and remove old files in `/opt/tapit-backups`. |

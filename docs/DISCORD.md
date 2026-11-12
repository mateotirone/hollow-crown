# Discord alerts

The add-on can tell the group's Discord when something happens, even when nobody is online: a siege night,
a Keep falling, the throne changing hands, a Choirsteel template holder away so long their vault opens.
Plan and reasoning: the "Discord alerts plan" doc in the project.

## How it works

A Realm can't make web requests (the only module that can, `@minecraft/server-net`, is beta and works only on a
dedicated server). So alerts leave through a **relay**: a second Minecraft account that a small program on an
always-on computer drops into the Realm every 15 minutes.

1. `Siege_Nights_BP/scripts/dispatch/` puts every alert into a numbered queue saved in the world (last 40 kept).
2. When a player with the tag `hc_relay` is online, the queue is sent to them as private chat lines nobody else sees.
   The relay is put in Spectator, gets no join greeting, and while it is the only one online the day cycle is
   frozen and no siege night can start, so its visits never move the world forward.
3. `tools/discord-relay/relay.mjs` reads the lines and posts each alert once to a Discord webhook.

Every alert is also printed to the content log as `[HC-ALERT] {json}`, so on a dedicated server the same program
reads the server's output instead (`bedrock_server | node relay.mjs --log`) and no relay account is needed.

Alerts about the Hollow (the template, Choir ore, robberies) stay silent until someone in that world has entered the
Hollow, so Discord never names it before the story does.

## Setting it up (Mateo)

1. Make the Discord server and a `#kingdom-news` channel. Channel settings > Integrations > Webhooks > New Webhook,
   copy its link. Keep it private: anyone with it can post there.
2. Get a second Microsoft account that owns Minecraft Bedrock. Invite it to the Realm.
3. In the Realm, as an operator: `/tag <relay gamertag> add hc_relay`.
4. On the always-on computer (needs Node 20+): copy `tools/discord-relay/`, run `npm install`, copy
   `config.example.json` to `config.json`, fill in the webhook link, the Realm invite code, and under `links` each
   player's gamertag paired with their Discord user id (Discord: Settings > Advanced > Developer Mode, then right-click
   a name > Copy User ID).
5. `node relay.mjs --realm`. The first run prints a Microsoft sign-in code: sign in as the relay account.
6. In game: `/scriptevent hc:dispatch_test`. Within 15 minutes the test line shows up on Discord.

After each Minecraft update the relay may fail to join for a few days until `bedrock-protocol` catches up
(`npm update` then). Alerts wait in the queue meanwhile; the game is unaffected.

## Adding an alert

From any feature: `emit("discordAlert", { kind, text, ping: [playerName], hollow })`. Wording for the built-in alerts
is in `dispatch/config.js`. The vault alerts use the `siege_template_holder` tag (PR #144) and real-world time:
`vaultOpenHours` (24) and `warnHoursBefore` (2).

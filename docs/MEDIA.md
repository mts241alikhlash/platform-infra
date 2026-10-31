# Media server for exam camera streams

One MediaMTX instance carries the live camera of every student sitting an exam.
It runs on its own box, not on the API VPS: the production stack already carries
29 images with each service capped at 320m, and 30 concurrent 400 kbps streams is
about 12 Mbps sustained through one host in both directions.

## Ports and protocols

| Port | Protocol | Who | Why |
| --- | --- | --- | --- |
| 8889 | HTTP/WHIP | the exam app | publishes the camera; plain HTTP, the host is DNS-only in Cloudflare |
| 8189 | ICE/UDP | the exam app | WebRTC media path |
| 8888 | HTTPS/HLS | supervisor page | plays in a `<video>` tag; TLS terminated by MediaMTX itself |

WHIP, not RTMP or SRT. Both of those were tried first: the app opened the socket,
reported `onConnectionSuccess`, and then sent no media, so the server saw a
connection and then EOF. WHIP publishes over HTTP and works. That required
RootEncoder 2.8.x, which in turn required Kotlin 2.3.21, AGP 8.13.2, Gradle 8.13
and Room 2.8.5 — all of that is already in `libs.versions.toml`.

The app publishes 1280×720 at 24 fps, ~1.5 Mbps per student. Thirty students is
about 45 Mbps upstream; check the school's link before a full class.

## ICE candidates

`MTX_WEBRTCADDITIONALHOSTS`, `MTX_WEBRTCNAT1TO1` and
`MTX_WEBRTCIPSFROMINTERFACES: "no"` are not optional. Without them MediaMTX
advertises `127.0.0.1` and the container's private address as ICE candidates,
the phone tries the first one, and the session ends with `deadline exceeded
while waiting connection` even though WHIP answered 201. The symptom is a
supervisor grid that spins forever while the seat still looks alive.

MediaMTX environment names are upper case throughout. `MTX_WEBRTCIPsFromInterfaces`
is silently ignored; only `MTX_WEBRTCIPSFROMINTERFACES` takes effect.

## Firewall

The media host needs 8189/udp, 8888/tcp and 8889/tcp open to the internet. The
UFW policy on the API VPS only allows 80/443 from Cloudflare ranges, so the
media host cannot be reached through the gateway: it is DNS-only in Cloudflare
and clients connect to these ports directly.

## Authentication

`MTX_AUTHHTTPADDRESS` points at `exam-service`'s `POST /internal/stream-auth`,
which:

- allows an action only on a 2xx answer, so a denial is a status code, never a
  200 with a false body;
- accepts `publish` only when the session is still `IN_PROGRESS` **and** the
  token's nonce is still the one stored on the row;
- accepts `read` only with an `hls-read` token naming that exact stream;
- returns `expireAt`, so an open publish session is closed and re-checked within
  a minute. A student who stops sending heartbeats loses the stream even though
  their token has not expired.

The route is machine-to-machine: `ProvisioningTokenGuard` refuses any request
carrying `X-Forwarded-For`, so it is unreachable from the public gateway.

## Recording

Off. No path records to disk, and `exam-service` has no endpoint to fetch a clip.
Streams are live only.

## Running it

```bash
docker network create mts241alikhlash-net   # once, if the API stack has not
cd platform-infra/compose
docker compose -f docker-compose.media.yml up -d
```

The certificate comes from `/etc/ssl/cloudflare`, the same origin certificate the
gateway already uses.

HLS is served by MediaMTX over TLS rather than through the gateway: the gateway
is generated from per-app manifests, and adding a media host would mean a fake
app entry in that generator. The supervisor page is `https`, so an `http`
playlist would be blocked as mixed content — TLS here is what makes the grid
load at all.

The media host needs a DNS record and a certificate for its own name; the
wildcard origin certificate already covers `*.mts241alikhlash.sch.id`.

## Checking it works

```bash
# the media server answers over TLS
curl -sk -o /dev/null -w '%{http_code}\n' https://127.0.0.1:8888/

# a publish without a token must be refused by the auth hook: MediaMTX logs
# "authentication failed" and closes the connection

# after starting a session in the app, the grid in assessment-web shows the seat
# within ten seconds; stopping the app from its notification turns it red within
# sixty.
```

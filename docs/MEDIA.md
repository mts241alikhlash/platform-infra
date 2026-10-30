# Media server for exam camera streams

One MediaMTX instance carries the live camera of every student sitting an exam.
It runs on its own box, not on the API VPS: the production stack already carries
29 images with each service capped at 320m, and 30 concurrent 400 kbps streams is
about 12 Mbps sustained through one host in both directions.

## Ports and protocols

| Port | Protocol | Who | Why |
| --- | --- | --- | --- |
| 1936 | RTMPS | the exam app | TLS, so a home router or CGNAT has nothing to block |
| 8888 | HTTPS/HLS | supervisor page | plays in a `<video>` tag; TLS terminated by MediaMTX itself |

RTMPS rather than WHIP: WHIP only exists in RootEncoder 2.8.x, which needs AGP
9.3 and Kotlin 2.4.10, while the app builds on AGP 8.9 and Kotlin 2.1.10.
Upgrading AGP is not part of this feature. The `StreamClient` class is the only
place that would change.

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

# 241-platform-infra

## 1.0.0

### Major Changes

- First stable release.

### Patch Changes

- Serve root static files such as `/logo.webp` and `/bg.webp` to `<img>` and `<link rel="icon">` loads (`Sec-Fetch-Mode: no-cors`) instead of answering them with the gateway's JSON 404.
  
  The production gateway image is now tagged with the bare version (`0.1.1`) and the staging image with a `-staging` suffix (`0.1.1-staging`); `scripts/latest-digests.mjs` reads the new tags.

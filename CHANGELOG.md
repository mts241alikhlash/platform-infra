# 241-platform-infra

## 1.1.3

### Patch Changes

- a976bdc: Rebuild the gateway for the production routes.
- 8c2e1e3: Rebuild the gateway for the staging routes.

## 1.1.2

### Patch Changes

- c50e669: Rebuild the gateway for the production routes.

## 1.1.1

### Patch Changes

- 72a0935: Rebuild the gateway for the staging routes.

## 1.1.0

### Minor Changes

- fe9573b: Add exam-service to the platform: upstream registry, compose service and migrate job for staging and production, the `exam` database, the deploy script, the digest helper, the lock pins for `exam-service` 0.2.0, and the docs. The gateway gains the `exam_service` upstream; its `/exam-questions`, `/exam-files` and `/exam-imports` routes arrive with assessment-web 1.5.0.

## 1.0.1

### Patch Changes

- eca167c: Rebuild the gateway for the production routes.
- a8d8094: Rebuild the gateway for the staging routes.

## 1.0.0

### Major Changes

- First stable release.

### Patch Changes

- Serve root static files such as `/logo.webp` and `/bg.webp` to `<img>` and `<link rel="icon">` loads (`Sec-Fetch-Mode: no-cors`) instead of answering them with the gateway's JSON 404.
  
  The production gateway image is now tagged with the bare version (`0.1.1`) and the staging image with a `-staging` suffix (`0.1.1-staging`); `scripts/latest-digests.mjs` reads the new tags.

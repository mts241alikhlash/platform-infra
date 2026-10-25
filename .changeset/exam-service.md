---
'241-platform-infra': minor
---

Add exam-service to the platform: upstream registry, compose service and migrate job for staging and production, the `exam` database, the deploy script, the digest helper, the lock pins for `exam-service` 0.2.0, and the docs. The gateway gains the `exam_service` upstream; its `/exam-questions`, `/exam-files` and `/exam-imports` routes arrive with assessment-web 1.5.0.

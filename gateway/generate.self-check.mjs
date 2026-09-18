#!/usr/bin/env node

import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  loadInputs,
  renderConfig,
  validateDeploymentLock,
  validateModel,
  validateManifest,
} from './generate.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.dirname(here)
const model = await loadInputs({ rootDir, environment: 'staging' })

assert.equal(model.manifests.length, 7)
const httpConfig = renderConfig(model, { ssl: false })
assert.equal(httpConfig, renderConfig(model, { ssl: false }))
assert.match(httpConfig, /default_type application\/json;/)
assert.match(httpConfig, /server_tokens off;/)
assert.match(httpConfig, /Route not handled by gateway/)
assert.match(httpConfig, /location ~ \^\/\(settings\)\(\/\|\$\)/)
assert.match(httpConfig, /server_name PORTAL_DOMAIN;/)
assert.match(httpConfig, /upstream academic_web \{[\s\S]*server academic-web:8080 resolve;/)
assert.match(httpConfig, /proxy_pass         http:\/\/academic_web;/)
assert.doesNotMatch(httpConfig, /root \/usr\/share\/nginx\/html\//)
assert.match(httpConfig, /server identity-service:3000 resolve;/)
assert.match(renderConfig(model, { ssl: true }), /listen 443 ssl;/)
assert.equal(validateModel({ manifests: model.manifests, upstreams: model.upstreams }), true)

await loadInputs({ rootDir, environment: 'production' })

const academic = structuredClone(model.manifests.find(({ app }) => app === 'academic'))
academic.servicePrefixes.identity.push('/auth')
assert.throws(
  () => validateModel({ ...model, manifests: [academic] }),
  /duplicate/,
)

const overlapping = structuredClone(model.manifests.find(({ app }) => app === 'academic'))
overlapping.servicePrefixes.identity.push('/auth/login')
assert.throws(
  () => validateModel({ ...model, manifests: [overlapping] }),
  /overlapping prefix/,
)

const routedAndUnroutedOverlap = structuredClone(
  model.manifests.find(({ app }) => app === 'academic'),
)
routedAndUnroutedOverlap.unroutedPrefixes = ['/auth']
assert.throws(
  () => validateModel({ ...model, manifests: [routedAndUnroutedOverlap] }),
  /duplicate prefix/,
)

const duplicateHost = structuredClone(model)
duplicateHost.deployments.admin.serverName = '_'
assert.throws(
  () => validateModel(duplicateHost),
  /duplicate gateway server name/,
)

const unknownService = structuredClone(model.manifests.find(({ app }) => app === 'academic'))
unknownService.servicePrefixes.unknown = ['/unknown']
assert.throws(
  () => validateModel({ ...model, manifests: [unknownService] }),
  /no upstream declared for "unknown"/,
)

const badUpstream = structuredClone(model)
badUpstream.upstreams.identity.port = 3999
assert.throws(
  () => validateDeploymentLock(badUpstream.lock, { upstreams: badUpstream.upstreams }),
  /deployment services\.identity\.upstream does not match upstream registry/,
)

const badChecksum = structuredClone(model)
badChecksum.artifacts[0].checksum = '0'.repeat(64)
assert.throws(() => validateModel(badChecksum), /manifest checksum mismatch/)

const unpinnedGateway = structuredClone(model.lock)
unpinnedGateway.gatewayImage =
  'ghcr.io/mts241alikhlash/platform-gateway@sha256:REPLACE_BEFORE_DEPLOYMENT'
assert.throws(
  () => validateDeploymentLock(unpinnedGateway, { requirePinnedImages: true }),
  /pinned by sha256 digest/,
)

const invalidManifest = structuredClone(model.manifests.find(({ app }) => app === 'academic'))
invalidManifest.schemaVersion = 2
assert.throws(() => validateManifest(invalidManifest, model.schema), /schemaVersion must be 1/)

const unsafePrefix = structuredClone(model.manifests.find(({ app }) => app === 'academic'))
unsafePrefix.servicePrefixes.identity.push('/auth$')
assert.throws(
  () => validateManifest(unsafePrefix, model.schema),
  /must be a lowercase URL prefix/,
)

const unsafeRoot = structuredClone(model.lock)
unsafeRoot.apps.academic.root = '/usr/share/../html/academic'
assert.throws(
  () => validateDeploymentLock(unsafeRoot),
  /must be an absolute path/,
)

console.log('gateway self-check passed')

import assert from 'node:assert/strict'
import { latestVersion, manifestFileName, referencedManifests } from './update-lock.mjs'

assert.equal(
  latestVersion(
    ['hr-web@0.1.0', 'hr-web@1.0.0', 'hr-web@1.10.0', 'hr-web@1.9.3', 'hr-web@2.0.0-rc.1', 'hr-webx@9.0.0'],
    'hr-web',
  ),
  '1.10.0',
)
assert.equal(latestVersion(['@mts241alikhlash/hr-api@3.0.0', 'hr-service@1.0.1'], 'hr-service'), '1.0.1')
assert.equal(latestVersion(['portal-web@1.0.0'], 'hr-web'), null)

assert.equal(manifestFileName('hr', '1.0.1'), 'hr-1.0.1.json')
assert.deepEqual(
  [
    ...referencedManifests([
      { apps: { hr: { routesVersion: '1.0.1' }, portal: { routesVersion: '1.0.0' } } },
      { apps: { hr: { routesVersion: '1.0.0' }, portal: { routesVersion: '1.0.0' } } },
    ]),
  ].sort(),
  ['hr-1.0.0.json', 'hr-1.0.1.json', 'portal-1.0.0.json'],
)

console.log('update-lock test passed')

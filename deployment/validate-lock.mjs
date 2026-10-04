import { loadInputs } from '../gateway/generate.mjs'

const environment = process.argv[2] ?? 'staging'
if (!['staging', 'production'].includes(environment)) {
  throw new Error(`invalid deployment environment ${environment}`)
}

await loadInputs({ environment, requirePinnedImages: environment === 'production' })
console.log(`${environment} deployment lock valid`)

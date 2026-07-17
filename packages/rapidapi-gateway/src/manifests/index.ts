import { emailVerifierManifest } from './email-verifier.js';
import { companyDataManifest } from './company-data.js';
import type { RapidApiManifest } from '../types.js';

export const BUILT_IN_MANIFESTS: readonly RapidApiManifest[] = [
  emailVerifierManifest,
  companyDataManifest,
];

export { emailVerifierManifest, companyDataManifest };

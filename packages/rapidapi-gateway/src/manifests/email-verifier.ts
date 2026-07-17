import type { RapidApiManifest } from '../types.js';

export const emailVerifierManifest: RapidApiManifest = {
  id: 'email-verifier',
  name: 'Email Verifier',
  description: 'Validates email addresses — checks format, DNS MX records, and SMTP reachability.',
  rapidApiHost: 'mailcheck.p.rapidapi.com',
  baseUrl: 'https://mailcheck.p.rapidapi.com',
  category: 'email',
  endpoints: [
    {
      id: 'verify',
      method: 'GET',
      path: '/',
      description: 'Verify a single email address',
      inputSchema: {
        type: 'object',
        required: ['domain'],
        properties: {
          domain: { type: 'string', description: 'Email address or domain to verify' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          valid: { type: 'boolean' },
          block: { type: 'boolean' },
          disposable: { type: 'boolean' },
          email: { type: 'string' },
          text: { type: 'string' },
        },
      },
      creditCost: 1,
    },
  ],
};

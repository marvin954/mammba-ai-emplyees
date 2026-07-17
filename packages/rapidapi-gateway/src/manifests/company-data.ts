import type { RapidApiManifest } from '../types.js';

export const companyDataManifest: RapidApiManifest = {
  id: 'company-data',
  name: 'Company Data Enrichment',
  description: 'Retrieves firmographic data for a company by domain — size, industry, location, funding.',
  rapidApiHost: 'company-data-api.p.rapidapi.com',
  baseUrl: 'https://company-data-api.p.rapidapi.com',
  category: 'company',
  endpoints: [
    {
      id: 'lookup',
      method: 'GET',
      path: '/v1/companies/domain',
      description: 'Look up company by domain',
      inputSchema: {
        type: 'object',
        required: ['domain'],
        properties: {
          domain: { type: 'string', description: 'Company domain, e.g. acme.com' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          domain: { type: 'string' },
          industry: { type: 'string' },
          size: { type: 'string' },
          location: { type: 'string' },
          linkedin_url: { type: 'string' },
          founded_year: { type: 'number' },
          description: { type: 'string' },
        },
      },
      creditCost: 2,
    },
  ],
};

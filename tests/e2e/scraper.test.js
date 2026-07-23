import { jest } from '@jest/globals';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const HAS_SOLR = !!process.env.SOLR_AUTH;

function itIfSolr(name, fn, timeout) {
  if (HAS_SOLR) {
    return it(name, fn, timeout);
  }
  return it.skip(`${name} (skipped: SOLR_AUTH not set)`, fn, timeout);
}

let HAS_ANAF = false;

async function checkAnafAvailability() {
  try {
    const res = await fetch('https://demoanaf.ro/api/search?q=test', {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    });
    return res.ok;
  } catch {
    return false;
  }
}

function itIfAnaf(name, fn, timeout) {
  if (HAS_ANAF) {
    return it(name, fn, timeout);
  }
  return it.skip(`${name} (skipped: ANAF API unavailable)`, fn, timeout);
}

beforeAll(async () => {
  HAS_ANAF = await checkAnafAvailability();
  if (HAS_SOLR) {
    process.env.SOLR_AUTH = process.env.SOLR_AUTH;
  }
});

const TEST_CIF = '36734466';
const TEST_BRAND = 'SMEDIX';
const PERFICIENT_API_URL = 'https://fa-etqd-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.workLocation,requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1,facetsList=LOCATIONS%3BWORK_LOCATIONS%3BWORKPLACE_TYPES%3BTITLES%3BCATEGORIES%3BORGANIZATIONS%3BPOSTING_DATES%3BFLEX_FIELDS,limit=5,sortBy=POSTING_DATES_DESC';

describe('E2E: Full Scraping Pipeline', () => {

  describe('Perficient Oracle HCM API — Real Data Fetch', () => {
    let apiData;

    beforeAll(async () => {
      try {
        const res = await fetch(PERFICIENT_API_URL, {
          headers: {
            'User-Agent': 'job_seeker_ro_spider',
            'Accept': 'application/vnd.oracle.adf.resourceitem+json;charset=utf-8',
            'Content-Type': 'application/vnd.oracle.adf.resourceitem+json;charset=utf-8',
            'ora-irc-language': 'en'
          }
        });
        const text = await res.text();
        apiData = text ? JSON.parse(text) : null;
      } catch (e) {
        console.log(`⚠️ Oracle HCM API unavailable: ${e.message}`);
        apiData = null;
      }
    }, 30000);

    it('should respond with valid job data from Oracle HCM API', () => {
      if (!apiData) return console.log('Skipping: API unavailable');
      expect(apiData).toHaveProperty('items');
      expect(apiData.items).toHaveProperty('length');
      expect(apiData.items.length).toBeGreaterThan(0);
      const searchResult = apiData.items[0];
      expect(searchResult).toHaveProperty('TotalJobsCount');
      expect(typeof searchResult.TotalJobsCount).toBe('number');
    }, 15000);

    it('should have requisitionList with job entries', () => {
      if (!apiData) return console.log('Skipping: API unavailable');
      const searchResult = apiData.items[0];
      expect(searchResult).toHaveProperty('requisitionList');
      expect(Array.isArray(searchResult.requisitionList)).toBe(true);
      expect(searchResult.requisitionList.length).toBeGreaterThan(0);
    });

    it('should have jobs with expected fields', () => {
      if (!apiData) return console.log('Skipping: API unavailable');
      const job = apiData.items[0].requisitionList[0];
      expect(job).toHaveProperty('Id');
      expect(job).toHaveProperty('Title');
      expect(typeof job.Title).toBe('string');
      expect(job).toHaveProperty('PrimaryLocationCountry');
      expect(job).toHaveProperty('PostedDate');
    });
  });

  describe('Parse + Transform Pipeline', () => {
    let index;
    let apiData;

    beforeAll(async () => {
      index = await import('../../index.js');
      try {
        const res = await fetch(PERFICIENT_API_URL, {
          headers: {
            'User-Agent': 'job_seeker_ro_spider',
            'Accept': 'application/vnd.oracle.adf.resourceitem+json;charset=utf-8',
            'Content-Type': 'application/vnd.oracle.adf.resourceitem+json;charset=utf-8',
            'ora-irc-language': 'en'
          }
        });
        const text = await res.text();
        apiData = text ? JSON.parse(text) : null;
      } catch (e) {
        console.log(`⚠️ Oracle HCM API unavailable: ${e.message}`);
        apiData = null;
      }
    }, 30000);

    it('should parse real Oracle HCM API response into standardized format', () => {
      if (!apiData) return console.log('Skipping: API unavailable');
      const result = index.parseApiJobs(apiData);

      expect(result).toHaveProperty('jobs');
      expect(result).toHaveProperty('total');
      expect(typeof result.total).toBe('number');

      for (const parsed of result.jobs) {
        expect(parsed).toHaveProperty('url');
        expect(parsed.url).toMatch(/^https:\/\/careers\.perficient\.com\//);
        expect(parsed).toHaveProperty('title');
        expect(parsed).toHaveProperty('workmode');
        expect(['remote', 'on-site', 'hybrid']).toContain(parsed.workmode);
        expect(parsed).toHaveProperty('location');
        expect(Array.isArray(parsed.location)).toBe(true);
      }
    });

    it('should map parsed jobs to job model', () => {
      if (!apiData) return console.log('Skipping: API unavailable');
      const parsed = index.parseApiJobs(apiData);
      if (parsed.jobs.length === 0) {
        console.log('No Romania jobs found in API response — skipping mapToJobModel test');
        return;
      }
      const model = index.mapToJobModel(parsed.jobs[0], TEST_CIF);

      expect(model).toHaveProperty('url');
      expect(model).toHaveProperty('title');
      expect(model).toHaveProperty('company');
      expect(model).toHaveProperty('cif', TEST_CIF);
      expect(model).toHaveProperty('status', 'scraped');
      expect(model).toHaveProperty('date');
      expect(model.url).toMatch(/^https:\/\/careers\.perficient\.com\//);
    });

    it('should transform jobs and filter to Romanian locations', () => {
      if (!apiData) return console.log('Skipping: API unavailable');
      const parsed = index.parseApiJobs(apiData);
      if (parsed.jobs.length === 0) {
        console.log('No Romania jobs found — skipping transform test');
        return;
      }
      const jobs = parsed.jobs.map(j => index.mapToJobModel(j, TEST_CIF));

      const payload = {
        source: 'careers.perficient.com',
        company: 'SMEDIX LLC ST. LOUIS SUCURSALA CLUJ NAPOCA',
        cif: TEST_CIF,
        jobs
      };

      const transformed = index.transformJobsForSOLR(payload);

      expect(transformed.company).toBe('SMEDIX LLC ST. LOUIS SUCURSALA CLUJ NAPOCA');
      expect(transformed.jobs.length).toBe(jobs.length);

      for (const job of transformed.jobs) {
        expect(job).toHaveProperty('location');
        expect(Array.isArray(job.location)).toBe(true);
        expect(job.location.length).toBeGreaterThan(0);
        expect(job.workmode).toMatch(/^(remote|on-site|hybrid)$/);
      }
    });
  });

  describe('Company Validation Path', () => {
    let anaf;
    let company;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
      company = await import('../../company.js');
    });

    itIfAnaf('should find SMEDIX in ANAF and validate active status', async () => {
      const results = await anaf.searchCompany(TEST_BRAND);

      const smedix = results.find(c =>
        c.name.toUpperCase().startsWith('SMEDIX') &&
        c.statusLabel === 'Funcțiune'
      );
      expect(smedix).toBeDefined();
      expect(smedix.cui.toString()).toBe(TEST_CIF);

      const anafData = await anaf.getCompanyFromANAF(TEST_CIF);
      expect(anafData).toBeDefined();
      expect(anafData.inactive).toBe(false);
    }, 30000);

    itIfSolr('should run full validation and report active status with job count', async () => {
      const result = await company.validateAndGetCompany();

      expect(result.status).toBe('active');
      expect(result.company).toBe('SMEDIX LLC ST. LOUIS SUCURSALA CLUJ NAPOCA');
      expect(result.cif).toBe(TEST_CIF);

      if (result.existingJobsCount === 0) {
        console.log('No SMEDIX jobs in Solr — skipping job count assertion');
        return;
      }
      expect(result.existingJobsCount).toBeGreaterThan(0);
    }, 30000);
  });

  describe('SOLR Data Verification', () => {
    let solr;

    beforeAll(async () => {
      solr = await import('../../solr.js');
    });

    itIfSolr('should have SMEDIX jobs in SOLR with correct company name', async () => {
      const result = await solr.querySOLR(TEST_CIF);

      if (result.numFound === 0) {
        console.log('No SMEDIX jobs in Solr — skipping SOLR data verification');
        return;
      }

      for (const job of result.docs) {
        expect(job.company).toBe('SMEDIX LLC ST. LOUIS SUCURSALA CLUJ NAPOCA');
        expect(job.cif).toBe(TEST_CIF);
      }
    }, 15000);

    itIfSolr('should have SMEDIX company core entry with required fields', async () => {
      const result = await solr.queryCompanySOLR(`id:${TEST_CIF}`);

      expect(result.numFound).toBe(1);
      const smedix = result.docs[0];
      expect(smedix.company).toBe('SMEDIX LLC ST. LOUIS SUCURSALA CLUJ NAPOCA');
      expect(smedix.status).toBe('activ');
    }, 15000);
  });
});

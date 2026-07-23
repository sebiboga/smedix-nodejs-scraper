import { jest } from '@jest/globals';

describe('index.js Component Tests', () => {
  let index;

  beforeAll(async () => {
    index = await import('../../index.js');
  });

  describe('transformJobsForSOLR', () => {
    it('should filter locations to only Romanian cities', () => {
      const payload = {
        jobs: [
          { url: 'https://test.com/1', title: 'Job 1', location: ['România'] },
          { url: 'https://test.com/2', title: 'Job 2', location: ['Bucharest'] },
          { url: 'https://test.com/3', title: 'Job 3', location: ['Bulgaria'] },
          { url: 'https://test.com/4', title: 'Job 4', location: ['Cluj-Napoca'] },
          { url: 'https://test.com/5', title: 'Job 5', location: [] }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.jobs[0].location).toEqual(['România']);
      expect(result.jobs[1].location).toEqual(['Bucharest']);
      expect(result.jobs[2].location).toEqual(['România']);
      expect(result.jobs[3].location).toEqual(['Cluj-Napoca']);
      expect(result.jobs[4].location).toEqual(['România']);
    });

    it('should keep company uppercase', () => {
      const payload = {
        source: 'careers.perficient.com',
        company: 'smedix llc st. louis sucursala cluj napoca',
        cif: '36734466',
        jobs: [
          { url: 'https://test.com/1', title: 'Job 1', company: 'smedix', cif: '36734466' }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.company).toBe('SMEDIX LLC ST. LOUIS SUCURSALA CLUJ NAPOCA');
    });

    it('should normalize workmode values', () => {
      const payload = {
        jobs: [
          { url: 'https://test.com/1', title: 'Job 1', workmode: 'Remote' },
          { url: 'https://test.com/2', title: 'Job 2', workmode: 'ON-SITE' },
          { url: 'https://test.com/3', title: 'Job 3', workmode: 'Hybrid' },
          { url: 'https://test.com/4', title: 'Job 4', workmode: 'hybrid' }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.jobs[0].workmode).toBe('remote');
      expect(result.jobs[1].workmode).toBe('on-site');
      expect(result.jobs[2].workmode).toBe('hybrid');
      expect(result.jobs[3].workmode).toBe('hybrid');
    });

    it('should handle empty jobs array', () => {
      const result = index.transformJobsForSOLR({ jobs: [] });
      expect(result.jobs).toEqual([]);
    });
  });

  describe('mapToJobModel', () => {
    it('should map raw job to job model format', () => {
      const rawJob = {
        url: 'https://careers.perficient.com/en/sites/CX_1/job/2026001234',
        title: 'Senior .NET Engineer',
        location: ['Cluj-Napoca'],
        tags: ['.net', 'c#'],
        workmode: 'hybrid'
      };

      const COMPANY_NAME = 'SMEDIX LLC ST. LOUIS SUCURSALA CLUJ NAPOCA';
      const COMPANY_CIF = '36734466';

      const result = index.mapToJobModel(rawJob, COMPANY_CIF, COMPANY_NAME);

      expect(result.url).toBe(rawJob.url);
      expect(result.title).toBe(rawJob.title);
      expect(result.company).toBe(COMPANY_NAME);
      expect(result.cif).toBe(COMPANY_CIF);
      expect(result.location).toEqual(rawJob.location);
      expect(result.tags).toEqual(rawJob.tags);
      expect(result.workmode).toBe(rawJob.workmode);
      expect(result.status).toBe('scraped');
      expect(result.date).toBeDefined();
    });

    it('should remove undefined fields', () => {
      const rawJob = {
        url: 'https://test.com/1',
        title: 'Job 1'
      };

      const result = index.mapToJobModel(rawJob, '36734466');

      expect(result.location).toBeUndefined();
      expect(result.tags).toBeUndefined();
      expect(result.workmode).toBeUndefined();
    });

    it('should handle missing title', () => {
      const rawJob = { url: 'https://test.com/1' };

      const result = index.mapToJobModel(rawJob, '36734466');

      expect(result.title).toBeUndefined();
      expect(result.url).toBe('https://test.com/1');
    });
  });

  describe('parseApiJobs', () => {
    it('should parse Oracle HCM API response and filter Romania jobs', () => {
      const apiData = {
        items: [{
          TotalJobsCount: 85,
          requisitionList: [
            {
              Id: '2026001234',
              Title: 'Senior .NET Engineer',
              PrimaryLocationCountry: 'RO',
              PrimaryLocation: 'CLUJ-NAPOCA, Romania',
              PostedDate: '2026-07-21',
              ShortDescriptionStr: 'We are looking for a .NET developer',
              WorkplaceType: '',
              workLocation: [{ TownOrCity: 'Cluj-Napoca', Country: 'RO' }],
              secondaryLocations: [],
              otherWorkLocations: []
            },
            {
              Id: '2026005678',
              Title: 'Account Executive',
              PrimaryLocationCountry: 'US',
              PrimaryLocation: 'Detroit, MI, United States',
              PostedDate: '2026-07-21',
              ShortDescriptionStr: 'Sales role',
              WorkplaceType: '',
              workLocation: [{ TownOrCity: 'Livonia', Country: 'US' }],
              secondaryLocations: [],
              otherWorkLocations: []
            }
          ]
        }]
      };

      const result = index.parseApiJobs(apiData);

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].title).toBe('Senior .NET Engineer');
      expect(result.jobs[0].uid).toBe('2026001234');
      expect(result.jobs[0].location).toEqual(['Cluj-Napoca']);
      expect(result.jobs[0].url).toBe('https://careers.perficient.com/en/sites/CX_1/job/2026001234');
      expect(result.total).toBe(85);
    });

    it('should handle empty requisition list', () => {
      const apiData = {
        items: [{
          TotalJobsCount: 0,
          requisitionList: []
        }]
      };

      const result = index.parseApiJobs(apiData);

      expect(result.jobs).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle missing items field', () => {
      const result = index.parseApiJobs({});

      expect(result.jobs).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should extract tech tags from job description', () => {
      const apiData = {
        items: [{
          TotalJobsCount: 1,
          requisitionList: [{
            Id: '2026009999',
            Title: 'Full Stack Developer',
            PrimaryLocationCountry: 'RO',
            PrimaryLocation: 'Cluj-Napoca, Romania',
            ShortDescriptionStr: 'Experience with .NET, Angular, and Azure cloud',
            WorkplaceType: '',
            workLocation: [{ TownOrCity: 'Cluj-Napoca', Country: 'RO' }],
            secondaryLocations: []
          }]
        }]
      };

      const result = index.parseApiJobs(apiData);

      expect(result.jobs[0].tags).toContain('.net');
      expect(result.jobs[0].tags).toContain('angular');
      expect(result.jobs[0].tags).toContain('azure');
    });
  });
});

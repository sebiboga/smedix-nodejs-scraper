# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-23

### Added
- Initial release — derived from [epam-systems-international-srl-nodejs-scraper](https://github.com/sebiboga/epam-systems-international-srl-nodejs-scraper)
- Job scraping from Perficient Oracle HCM Cloud API (careers.perficient.com)
- Company validation via ANAF (CIF: 36734466)
- ANOFM job scraping by CIF
- Solr integration for job storage
- GitHub Actions workflows for daily scraping and testing
- Comprehensive test suite (unit, integration, E2E, consistency)
- ANAF API fallback with cached data support
- Node 24 compatibility

### Features
- Automated daily job scraping from Perficient careers (Oracle HCM Cloud)
- Company core validation and management
- Job URL validation
- Data integrity checks
- Romanian location filtering (RO country code)
- Work mode normalization
- GitHub Pages with live job board

## License

Copyright (c) 2024-2026 BOGA SEBASTIAN-NICOLAE
Licensed under MIT License

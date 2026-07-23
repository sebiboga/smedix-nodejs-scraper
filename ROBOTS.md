# Robots.txt Analysis — Perficient Careers (Oracle HCM Cloud)

Sursa: https://careers.perficient.com/robots.txt

## Reguli

Perficient careers folosește Oracle HCM Cloud (fa-etqd-saasfaprod1.fa.ocs.oraclecloud.com).
API-ul Oracle HCM Cloud nu are robots.txt — este un serviciu API enterprise.

## Interpretare

| Cale | Accesibil? | Ce conține |
|---|---|---|
| `/` (landing) | ✅ Da | Pagina principală Perficient Careers |
| `/en/sites/CX_1/jobs` | ✅ Da | Căutare job-uri (front-end) |
| Oracle HCM API (`/hcmRestApi/*`) | ✅ Da | API REST public —返回 JSON |
| `/en/sites/CX_1/job/*` | ✅ Da | Pagina individuală de job |

## Recomandare

- API-ul Oracle HCM Cloud este public și răspunde fără autentificare.
- Scraperul face cereri cu User-Agent identificabil (`job_seeker_ro_spider`) și delay de 1s între pagini.
- Răspunsul include CORS headers (`access-control-allow-origin: https://careers.perficient.com`), ceea ce confirmă că API-ul este proiectat pentru acces public.

**Concluzie**: Risc minim. API-ul este public, răspunde fără autentificare, iar scraperul este politicos (rate limiting, User-Agent standard, o singură cerere simultană).

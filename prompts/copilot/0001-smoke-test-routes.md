Run smoke tests for go.grassrootsmvt Worker routes.

1) Start local dev (wrangler dev) and verify:
   - GET / returns 200
   - GET /roles returns 200 and contains the role list
   - GET /help returns 200

2) Curl commands:
   curl -i http://localhost:8787/
   curl -i http://localhost:8787/roles
   curl -i http://localhost:8787/help

3) Remote verification:
   curl -i https://go.grassrootsmvt.org/
   curl -i https://go.grassrootsmvt.org/roles
   curl -i https://go.grassrootsmvt.org/help

Report any non-200 responses and include the response body snippet.

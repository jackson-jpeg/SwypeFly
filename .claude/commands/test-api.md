# test-api — test SoGoJet API endpoints

## Endpoint: $ARGUMENTS

Test the SoGoJet/SwypeFly API. Check the codebase for the base URL and auth requirements.

1. Find the API base URL from the app's config/environment files.
2. Curl the endpoint with appropriate auth headers.
3. Pretty-print the response.
4. Flag any errors, slow responses (>2s), or unexpected shapes.

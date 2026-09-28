# PeakRush Gateway
Spring Boot 3.5.14 / Spring Cloud 2025.0.3 / Java17. Routes /api/** to the backend. Default bind127.0.0.1:8080.
Purchase POSTs use one atomic Redis script for global/IP/bearer token windows. Default limits 1500/1200/20 per second. Raw credentials are never stored in limiter keys.
Backend authenticates bearer tokens and enforces user ownership; the gateway token bucket is an additional abuse control. X-Forwarded-For is not trusted.
Redis failure returns503 without admitting a purchase.429 includes Retry-After. This adds Redis dependency even to V0/V1 through gateway; compare all stages through the same entry point or explicitly document direct-backend benchmark topology.
Env: BACKEND_URI, REDIS_HOST/PORT, RATE_GLOBAL/IP/TOKEN, RATE_LIMIT_ENABLED, GATEWAY_HOST/PORT.
Sources: https://spring.io/projects/spring-cloud/ and https://spring.io/blog/2026/06/11/spring-cloud-2025-0-3-aka-northfields-has-been-released/


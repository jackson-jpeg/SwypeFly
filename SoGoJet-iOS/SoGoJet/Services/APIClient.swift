import Foundation

// MARK: - API Client
// Singleton actor for all network requests to the SoGoJet Vercel backend.

actor APIClient {
    static let shared = APIClient()

    private let baseURL = "https://www.sogojet.com/api"
    private let session: URLSession
    private let decoder: JSONDecoder

    /// Auth token set by AuthStore — included as Bearer header on all requests when available.
    /// nonisolated(unsafe) because this is set from @MainActor (AuthStore) and read from the actor.
    nonisolated(unsafe) static var authToken: String?

    /// Posted when a 401 response invalidates the session token.
    static let sessionExpired = Notification.Name("sg_session_expired")

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)

        let dec = JSONDecoder()
        // Do NOT use .convertFromSnakeCase — the API returns camelCase keys
        // (iataCode, vibeTags, flightPrice, etc). Only available_flight_days
        // is snake_case, handled by CodingKeys in Deal.swift.
        self.decoder = dec
    }

    // MARK: Endpoints

    enum Endpoint {
        case feed(origin: String, page: Int, vibes: [String], search: String?)
        case destination(id: String, origin: String?)
        case destinationMonthly(origin: String, destination: String)
        case topDeals(origin: String, limit: Int)
        case bookingSearch(
            origin: String,
            destination: String,
            date: String,
            returnDate: String?,
            passengers: Int,
            cabinClass: String?,
            priceHint: Double?
        )
        case bookingOffer(
            offerId: String,
            origin: String?,
            destination: String?,
            departureDate: String?,
            returnDate: String?,
            cabinClass: String?
        )
        case bookingPaymentIntent(
            offerId: String,
            amount: Int,
            currency: String,
            email: String?
        )
        case bookingCreateOrder(BookingCreateOrderRequest)
        case bookingOrder(orderId: String)
        case swipe(dealId: String, action: String)
        case alertCreate(destination: String, maxPrice: Int)
        case subscribe(email: String)
        case auth(identityToken: String, givenName: String?, familyName: String?, email: String?)
        case authOAuth(code: String, redirectUri: String)
        case deleteAccount(authToken: String)
        case savedList
        case savedSave(dealId: String)
        case savedUnsave(dealId: String)

        var path: String {
            switch self {
                case .feed:           return "/feed"
                case .destination,
                     .destinationMonthly:
                    return "/destination"
                case .topDeals:       return "/top-deals"
                case .bookingSearch,
                     .bookingOffer,
                     .bookingPaymentIntent,
                     .bookingCreateOrder,
                     .bookingOrder:
                    return "/booking"
                case .swipe:          return "/swipe"
                case .alertCreate:    return "/alerts"
                case .subscribe:      return "/subscribe"
                case .auth,
                     .authOAuth,
                     .deleteAccount:  return "/auth"
                case .savedList,
                     .savedSave,
                     .savedUnsave:    return "/saved"
            }
        }

        var method: String {
            switch self {
            case .swipe,
                 .alertCreate,
                 .subscribe,
                 .bookingSearch,
                 .bookingPaymentIntent,
                 .bookingCreateOrder,
                 .auth,
                 .authOAuth,
                 .savedSave,
                 .savedUnsave:
                return "POST"
            case .deleteAccount:
                return "DELETE"
            default:
                return "GET"
            }
        }

        var queryItems: [URLQueryItem] {
            switch self {
            case let .feed(origin, page, vibes, search):
                var items = [
                    URLQueryItem(name: "origin", value: origin),
                    URLQueryItem(name: "page", value: String(page)),
                ]
                if !vibes.isEmpty {
                    items.append(URLQueryItem(name: "vibes", value: vibes.joined(separator: ",")))
                }
                if let search, !search.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    items.append(URLQueryItem(name: "search", value: search))
                }
                return items

            case let .destination(id, origin):
                var items = [URLQueryItem(name: "id", value: id)]
                if let origin {
                    items.append(URLQueryItem(name: "origin", value: origin))
                }
                return items

            case let .destinationMonthly(origin, destination):
                return [
                    URLQueryItem(name: "action", value: "monthly"),
                    URLQueryItem(name: "origin", value: origin),
                    URLQueryItem(name: "destination", value: destination),
                ]

            case let .topDeals(origin, limit):
                return [
                    URLQueryItem(name: "origin", value: origin),
                    URLQueryItem(name: "limit", value: String(limit)),
                ]

            case let .bookingOffer(offerId, origin, destination, departureDate, returnDate, cabinClass):
                var items = [
                    URLQueryItem(name: "action", value: "offer"),
                    URLQueryItem(name: "offerId", value: offerId),
                ]
                if let origin { items.append(URLQueryItem(name: "origin", value: origin)) }
                if let destination { items.append(URLQueryItem(name: "destination", value: destination)) }
                if let departureDate { items.append(URLQueryItem(name: "departureDate", value: departureDate)) }
                if let returnDate { items.append(URLQueryItem(name: "returnDate", value: returnDate)) }
                if let cabinClass { items.append(URLQueryItem(name: "cabinClass", value: cabinClass)) }
                return items

            case let .bookingOrder(orderId):
                return [
                    URLQueryItem(name: "action", value: "order"),
                    URLQueryItem(name: "orderId", value: orderId),
                ]

            case .bookingSearch:
                return [URLQueryItem(name: "action", value: "search")]

            case .bookingPaymentIntent:
                return [URLQueryItem(name: "action", value: "payment-intent")]

            case .bookingCreateOrder:
                return [URLQueryItem(name: "action", value: "create-order")]

            case .auth:
                return [URLQueryItem(name: "action", value: "apple")]

            case .authOAuth:
                return [URLQueryItem(name: "action", value: "oauth")]

            case .deleteAccount:
                return [URLQueryItem(name: "action", value: "delete")]

            case .savedList:
                return [URLQueryItem(name: "action", value: "list")]

            case .savedSave:
                return [URLQueryItem(name: "action", value: "save")]

            case .savedUnsave:
                return [URLQueryItem(name: "action", value: "unsave")]

            default:
                return []
            }
        }

        var body: Data? {
            switch self {
            case let .swipe(dealId, action):
                return try? JSONEncoder().encode(["dealId": dealId, "action": action])

            case let .alertCreate(destination, maxPrice):
                return try? JSONSerialization.data(
                    withJSONObject: ["destination": destination, "maxPrice": maxPrice]
                )

            case let .subscribe(email):
                return try? JSONEncoder().encode(["email": email])

            case let .bookingSearch(origin, destination, date, returnDate, passengers, cabinClass, priceHint):
                var body: [String: Any] = [
                    "origin": origin,
                    "destination": destination,
                    "departureDate": date,
                    "passengers": Array(repeating: ["type": "adult"], count: max(passengers, 1)),
                ]
                if let returnDate {
                    body["returnDate"] = returnDate
                }
                if let cabinClass {
                    body["cabinClass"] = cabinClass
                }
                if let priceHint {
                    body["priceHint"] = priceHint
                }
                return try? JSONSerialization.data(withJSONObject: body)

            case let .bookingPaymentIntent(offerId, amount, currency, email):
                var body: [String: Any] = [
                    "offerId": offerId,
                    "amount": amount,
                    "currency": currency,
                ]
                if let email, !email.isEmpty {
                    body["email"] = email
                }
                return try? JSONSerialization.data(withJSONObject: body)

            case let .bookingCreateOrder(request):
                let encoder = JSONEncoder()
                return try? encoder.encode(request)

            case let .auth(identityToken, givenName, familyName, email):
                var body: [String: Any] = ["identityToken": identityToken]
                if let givenName { body["givenName"] = givenName }
                if let familyName { body["familyName"] = familyName }
                if let email { body["email"] = email }
                return try? JSONSerialization.data(withJSONObject: body)

            case let .authOAuth(code, redirectUri):
                return try? JSONSerialization.data(withJSONObject: [
                    "code": code,
                    "redirect_uri": redirectUri,
                ])

            case let .savedSave(dealId):
                return try? JSONEncoder().encode(["dealId": dealId])

            case let .savedUnsave(dealId):
                return try? JSONEncoder().encode(["dealId": dealId])

            default:
                return nil
            }
        }

        /// Optional Bearer token for authenticated endpoints.
        var authorizationHeader: String? {
            switch self {
            case let .deleteAccount(authToken):
                return "Bearer \(authToken)"
            default:
                return nil
            }
        }
    }

    // MARK: Generic Fetch

    /// Perform a request and decode the JSON response into `T`.
    /// Retries transient errors (timeout, network, 502/503/504) and 429 (rate limit).
    /// Does not retry permanent client errors (400, 401, 403, 404, 422).
    func fetch<T: Decodable>(_ endpoint: Endpoint, retries: Int = 2) async throws -> T {
        var lastError: Error?

        for attempt in 0...retries {
            // Delay before retry attempts
            if attempt > 0 {
                #if DEBUG
                print("[APIClient] Retry attempt \(attempt) for \(endpoint.path)")
                #endif
                try await Task.sleep(nanoseconds: UInt64(attempt) * 1_000_000_000)
            }

            do {
                return try await performRequest(endpoint)
            } catch let error as APIError {
                lastError = error

                switch error {
                case .httpError(let code, _):
                    // 401: token expired — clear auth and notify UI
                    if code == 401 {
                        APIClient.authToken = nil
                        Task { @MainActor in
                            NotificationCenter.default.post(name: APIClient.sessionExpired, object: nil)
                        }
                    }
                    // 429: rate limited — respect Retry-After or wait 5s
                    if code == 429 {
                        if attempt < retries {
                            let jitter = UInt64.random(in: 0...2_000_000_000)
                            try await Task.sleep(nanoseconds: 5_000_000_000 + jitter)
                        }
                        continue
                    }
                    // Permanent client errors — don't retry
                    if (400...499).contains(code) && code != 429 {
                        throw error
                    }
                    // 5xx server errors (502, 503, 504 etc.) — retry
                    continue

                case .decodingFailed:
                    // Bad data from server won't improve on retry
                    throw error

                case .invalidURL:
                    throw error

                case .invalidResponse:
                    // Transient — retry
                    continue
                }
            } catch let error as URLError {
                lastError = error
                // Transient network errors — retry
                switch error.code {
                case .timedOut,
                     .notConnectedToInternet,
                     .networkConnectionLost,
                     .cannotConnectToHost,
                     .cannotFindHost,
                     .dnsLookupFailed:
                    continue
                default:
                    throw error
                }
            } catch {
                // Unknown errors — don't retry
                throw error
            }
        }

        throw lastError!
    }

    // MARK: Single Request

    /// Perform a single network request and decode the response.
    private func performRequest<T: Decodable>(_ endpoint: Endpoint) async throws -> T {
        let url = try buildURL(for: endpoint)
        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("SoGoJet-iOS/1.0", forHTTPHeaderField: "User-Agent")

        // Use endpoint-specific auth header if available, otherwise use global auth token
        if let authHeader = endpoint.authorizationHeader {
            request.setValue(authHeader, forHTTPHeaderField: "Authorization")
        } else if let token = APIClient.authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = endpoint.body {
            request.httpBody = body
        }

        let (data, response) = try await session.data(for: request)

        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw APIError.httpError(statusCode: http.statusCode, body: body)
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            #if DEBUG
            print("⚠️ [APIClient] Decoding \(T.self) failed: \(error)")
            if let json = String(data: data.prefix(500), encoding: .utf8) {
                print("⚠️ [APIClient] Response preview: \(json)")
            }
            #endif
            throw APIError.decodingFailed(error)
        }
    }

    // MARK: URL Builder

    private func buildURL(for endpoint: Endpoint) throws -> URL {
        guard var components = URLComponents(string: baseURL + endpoint.path) else {
            throw APIError.invalidURL
        }
        let items = endpoint.queryItems
        if !items.isEmpty {
            components.queryItems = items
        }
        guard let url = components.url else {
            throw APIError.invalidURL
        }
        return url
    }
}

// MARK: - API Error

// MARK: - Empty Response (for endpoints that return {} or minimal JSON)

struct EmptyResponse: Codable {}

// MARK: - API Error

enum APIError: LocalizedError, Sendable {
    case invalidURL
    case invalidResponse
    case httpError(statusCode: Int, body: String)
    case decodingFailed(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Something went wrong. Please try again."
        case .invalidResponse:
            return "We couldn't reach the server. Check your connection and try again."
        case let .httpError(code, _):
            switch code {
            case 401:
                return "Sign in to continue."
            case 403:
                return "You don't have access to this. Try signing in again."
            case 404:
                return "We couldn't find what you're looking for."
            case 429:
                return "Too many requests. Please wait a moment and try again."
            case 500...599:
                return "Our servers are having a moment. Please try again shortly."
            default:
                return "Something went wrong (error \(code)). Please try again."
            }
        case .decodingFailed:
            return "We got an unexpected response. Please try again."
        }
    }

    /// Raw technical detail for logging — never show this to users.
    var technicalDescription: String {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid server response"
        case let .httpError(code, body):
            return "HTTP \(code): \(body.prefix(200))"
        case let .decodingFailed(err):
            return "Decoding failed: \(err.localizedDescription)"
        }
    }
}

import Testing
import Foundation
@testable import SoGoJet

@Suite("AuthStore OAuth Callback Parsing")
struct AuthStoreTests {

    private func components(from query: String) -> URLComponents {
        var c = URLComponents()
        c.scheme = "sogojet"
        c.host = "oauth-callback"
        c.queryItems = URLComponents(string: "?\(query)")?.queryItems
        return c
    }

    @Test("Completed OAuth with rotating token")
    func completedOAuth() {
        let c = components(from: "__clerk_status=completed&rotating_token=tok_abc123")
        let result = AuthStore.parseOAuthCallback(c)
        if case let .completed(token) = result {
            #expect(token == "tok_abc123")
        } else {
            Issue.record("Expected .completed, got \(result)")
        }
    }

    @Test("Code exchange with authorization code")
    func codeExchange() {
        let c = components(from: "code=auth_code_xyz")
        let result = AuthStore.parseOAuthCallback(c)
        if case let .codeExchange(code) = result {
            #expect(code == "auth_code_xyz")
        } else {
            Issue.record("Expected .codeExchange, got \(result)")
        }
    }

    @Test("Clerk ticket")
    func clerkTicket() {
        let c = components(from: "__clerk_ticket=ticket_value_456")
        let result = AuthStore.parseOAuthCallback(c)
        if case let .ticket(value) = result {
            #expect(value == "ticket_value_456")
        } else {
            Issue.record("Expected .ticket, got \(result)")
        }
    }

    @Test("Failed when no recognized params")
    func failedNoParams() {
        let c = components(from: "foo=bar")
        let result = AuthStore.parseOAuthCallback(c)
        if case .failed = result {
            // Expected
        } else {
            Issue.record("Expected .failed, got \(result)")
        }
    }

    @Test("Failed when status is not completed")
    func failedIncompleteStatus() {
        let c = components(from: "__clerk_status=pending&rotating_token=tok_abc")
        let result = AuthStore.parseOAuthCallback(c)
        // Status is "pending" not "completed", so rotating_token path shouldn't match
        // Should fall through to code check (no code) → ticket check (no ticket) → failed
        if case .failed = result {
            // Expected
        } else {
            Issue.record("Expected .failed for pending status, got \(result)")
        }
    }

    @Test("Empty query items returns failed")
    func emptyQuery() {
        var c = URLComponents()
        c.scheme = "sogojet"
        c.host = "oauth-callback"
        let result = AuthStore.parseOAuthCallback(c)
        if case .failed = result {
            // Expected
        } else {
            Issue.record("Expected .failed, got \(result)")
        }
    }

    @Test("Priority: completed > code > ticket")
    func priority() {
        // When all three are present, completed should win
        let c = components(from: "__clerk_status=completed&rotating_token=tok&code=cd&__clerk_ticket=tkt")
        let result = AuthStore.parseOAuthCallback(c)
        if case let .completed(token) = result {
            #expect(token == "tok")
        } else {
            Issue.record("Expected .completed to take priority, got \(result)")
        }
    }
}

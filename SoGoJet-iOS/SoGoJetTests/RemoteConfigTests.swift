import Testing
@testable import SoGoJet

@Suite("RemoteConfig Version Comparison")
struct RemoteConfigTests {

    @Test("Same version is not older")
    func sameVersion() {
        #expect(!RemoteConfig.compareVersions("1.0.0", isOlderThan: "1.0.0"))
    }

    @Test("Older major version")
    func olderMajor() {
        #expect(RemoteConfig.compareVersions("1.0.0", isOlderThan: "2.0.0"))
    }

    @Test("Newer major version is not older")
    func newerMajor() {
        #expect(!RemoteConfig.compareVersions("2.0.0", isOlderThan: "1.0.0"))
    }

    @Test("Older minor version")
    func olderMinor() {
        #expect(RemoteConfig.compareVersions("1.0.0", isOlderThan: "1.1.0"))
    }

    @Test("Older patch version")
    func olderPatch() {
        #expect(RemoteConfig.compareVersions("1.0.0", isOlderThan: "1.0.1"))
    }

    @Test("Newer minor version is not older")
    func newerMinor() {
        #expect(!RemoteConfig.compareVersions("1.2.0", isOlderThan: "1.1.0"))
    }

    @Test("Missing patch component treated as zero")
    func missingPatch() {
        #expect(!RemoteConfig.compareVersions("1.0.0", isOlderThan: "1.0"))
        #expect(RemoteConfig.compareVersions("1.0", isOlderThan: "1.0.1"))
    }

    @Test("Multi-digit version numbers")
    func multiDigit() {
        #expect(RemoteConfig.compareVersions("1.9.0", isOlderThan: "1.10.0"))
        #expect(!RemoteConfig.compareVersions("1.10.0", isOlderThan: "1.9.0"))
    }
}

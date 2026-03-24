import SwiftUI
import CryptoKit

// MARK: - Image Cache
// Two-tier cache: in-memory NSCache + on-disk FileManager in Caches directory.

actor ImageCache {
    static let shared = ImageCache()

    private let memoryCache = NSCache<NSString, UIImage>()
    private let diskDirectory: URL

    private init() {
        memoryCache.countLimit = 50

        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        diskDirectory = caches.appendingPathComponent("SGImageCache", isDirectory: true)

        try? FileManager.default.createDirectory(at: diskDirectory, withIntermediateDirectories: true)
    }

    // MARK: Public API

    /// Load image from cache or network. Returns nil on failure.
    func image(for urlString: String) async -> UIImage? {
        let key = cacheKey(for: urlString)

        // 1. Memory
        if let cached = memoryCache.object(forKey: key as NSString) {
            return cached
        }

        // 2. Disk
        let diskPath = diskDirectory.appendingPathComponent(key)
        if let data = try? Data(contentsOf: diskPath),
           let img = UIImage(data: data) {
            memoryCache.setObject(img, forKey: key as NSString)
            return img
        }

        // 3. Network
        guard let url = URL(string: urlString) else { return nil }
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let http = response as? HTTPURLResponse,
                  (200...299).contains(http.statusCode),
                  let img = UIImage(data: data) else { return nil }

            // Store in memory + disk
            memoryCache.setObject(img, forKey: key as NSString)
            try? data.write(to: diskPath, options: .atomic)

            return img
        } catch {
            return nil
        }
    }

    /// Remove all cached images.
    func clearAll() {
        memoryCache.removeAllObjects()
        try? FileManager.default.removeItem(at: diskDirectory)
        try? FileManager.default.createDirectory(at: diskDirectory, withIntermediateDirectories: true)
    }

    // MARK: Private

    private func cacheKey(for urlString: String) -> String {
        let digest = SHA256.hash(data: Data(urlString.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}

// MARK: - CachedAsyncImage

/// A SwiftUI view that loads and caches images from a URL string.
struct CachedAsyncImage<Placeholder: View>: View {
    let urlString: String?
    let placeholder: () -> Placeholder

    @State private var uiImage: UIImage?
    @State private var isLoading = true

    init(url urlString: String?, @ViewBuilder placeholder: @escaping () -> Placeholder) {
        self.urlString = urlString
        self.placeholder = placeholder
    }

    var body: some View {
        Group {
            if let uiImage {
                Image(uiImage: uiImage)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } else if isLoading {
                placeholder()
            } else {
                placeholder()
            }
        }
        .task(id: urlString) {
            guard let urlString else {
                isLoading = false
                return
            }
            isLoading = true
            uiImage = await ImageCache.shared.image(for: urlString)
            isLoading = false
        }
    }
}

// Convenience initialiser with default shimmer placeholder.
extension CachedAsyncImage where Placeholder == Color {
    init(url urlString: String?) {
        self.init(url: urlString) {
            Color.sgSurface
        }
    }
}

import SwiftUI
import CryptoKit

// MARK: - Image Cache
// Two-tier cache: in-memory NSCache + on-disk FileManager in Caches directory.

actor ImageCache {
    static let shared = ImageCache()

    private let memoryCache = NSCache<NSString, UIImage>()
    private let diskDirectory: URL
    private let maxDiskBytes = 100 * 1024 * 1024

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
            touch(fileURL: diskPath)
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
            touch(fileURL: diskPath)
            enforceDiskLimit()

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

    private func touch(fileURL: URL) {
        try? FileManager.default.setAttributes(
            [.modificationDate: Date()],
            ofItemAtPath: fileURL.path
        )
    }

    private func enforceDiskLimit() {
        let keys: Set<URLResourceKey> = [.isRegularFileKey, .fileSizeKey, .contentModificationDateKey]
        guard let enumerator = FileManager.default.enumerator(
            at: diskDirectory,
            includingPropertiesForKeys: Array(keys)
        ) else {
            return
        }

        var files: [(url: URL, size: Int, modified: Date)] = []
        var totalSize = 0

        for case let url as URL in enumerator {
            guard
                let values = try? url.resourceValues(forKeys: keys),
                values.isRegularFile == true,
                let size = values.fileSize
            else {
                continue
            }

            let modified = values.contentModificationDate ?? .distantPast
            files.append((url, size, modified))
            totalSize += size
        }

        guard totalSize > maxDiskBytes else { return }

        for file in files.sorted(by: { $0.modified < $1.modified }) {
            try? FileManager.default.removeItem(at: file.url)
            totalSize -= file.size
            if totalSize <= maxDiskBytes {
                break
            }
        }
    }
}

struct ShimmerView: View {
    @State private var phase: CGFloat = -1

    var body: some View {
        Color.sgSurface
            .overlay(
                LinearGradient(
                    colors: [.clear, Color.sgFaint.opacity(0.3), .clear],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .offset(x: phase * 300)
            )
            .clipped()
            .onAppear {
                phase = -1
                withAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
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

extension CachedAsyncImage where Placeholder == ShimmerView {
    init(url urlString: String?) {
        self.init(url: urlString) {
            ShimmerView()
        }
    }
}

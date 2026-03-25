import SwiftUI
import CryptoKit
import ImageIO

// MARK: - Image Cache
// Two-tier cache: in-memory NSCache + on-disk FileManager in Caches directory.
// Images are downsampled to screen size on decode to prevent OOM crashes from
// multi-megapixel Unsplash photos (a 4000x3000 image = ~48 MB uncompressed).

actor ImageCache {
    static let shared = ImageCache()

    private let memoryCache = NSCache<NSString, UIImage>()
    private let diskDirectory: URL
    private let maxDiskBytes = 100 * 1024 * 1024

    /// Maximum pixel dimension for downsampled images.
    /// Defaults to 3x of 430pt (1290px) which covers iPhone Pro Max.
    /// Updated from main thread on first access if possible.
    private var maxPixelSize: CGFloat = 1290

    private init() {
        memoryCache.countLimit = 50
        // Cap memory cache at ~120 MB of decoded pixel data.
        memoryCache.totalCostLimit = 120 * 1024 * 1024

        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        diskDirectory = caches.appendingPathComponent("SGImageCache", isDirectory: true)

        try? FileManager.default.createDirectory(at: diskDirectory, withIntermediateDirectories: true)

        // Flush memory cache when the system is under memory pressure.
        NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification,
            object: nil,
            queue: .main
        ) { [weak memoryCache] _ in
            memoryCache?.removeAllObjects()
            #if DEBUG
            print("[ImageCache] Memory warning — flushed in-memory cache")
            #endif
        }
    }

    /// Call from @MainActor context to set the actual screen pixel size.
    func updateMaxPixelSize(_ size: CGFloat) {
        maxPixelSize = size
    }

    // MARK: Public API

    /// Check if an image is already in the memory cache (instant load, no fade needed).
    func isInMemory(_ urlString: String) -> Bool {
        let key = cacheKey(for: urlString)
        return memoryCache.object(forKey: key as NSString) != nil
    }

    /// Load image from cache or network. Returns nil on failure.
    /// Images are automatically downsampled to screen resolution.
    func image(for urlString: String) async -> UIImage? {
        let key = cacheKey(for: urlString)

        // 1. Memory
        if let cached = memoryCache.object(forKey: key as NSString) {
            return cached
        }

        // 2. Disk (downsample on decode to avoid full-size bitmap)
        let diskPath = diskDirectory.appendingPathComponent(key)
        if FileManager.default.fileExists(atPath: diskPath.path),
           let img = downsampledImage(at: diskPath) {
            let cost = imageCost(img)
            memoryCache.setObject(img, forKey: key as NSString, cost: cost)
            touch(fileURL: diskPath)
            return img
        }

        // 3. Network
        guard let url = URL(string: urlString) else { return nil }
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let http = response as? HTTPURLResponse,
                  (200...299).contains(http.statusCode) else { return nil }

            // Write raw data to disk first, then downsample from disk.
            // This avoids holding both the raw data AND the full bitmap in memory.
            try? data.write(to: diskPath, options: .atomic)
            touch(fileURL: diskPath)
            enforceDiskLimit()

            guard let img = downsampledImage(at: diskPath) else {
                // Fallback: decode in-memory if disk downsample fails
                guard let fallback = UIImage(data: data) else { return nil }
                let cost = imageCost(fallback)
                memoryCache.setObject(fallback, forKey: key as NSString, cost: cost)
                return fallback
            }

            let cost = imageCost(img)
            memoryCache.setObject(img, forKey: key as NSString, cost: cost)
            return img
        } catch {
            return nil
        }
    }

    /// Prefetch an image into cache without returning it.
    /// Fires and forgets — used to warm the cache for upcoming cards.
    func prefetch(_ urlString: String) async {
        let key = cacheKey(for: urlString)

        // Already in memory — nothing to do
        if memoryCache.object(forKey: key as NSString) != nil { return }

        // Already on disk — promote to memory
        let diskPath = diskDirectory.appendingPathComponent(key)
        if FileManager.default.fileExists(atPath: diskPath.path) {
            if let img = downsampledImage(at: diskPath) {
                let cost = imageCost(img)
                memoryCache.setObject(img, forKey: key as NSString, cost: cost)
                touch(fileURL: diskPath)
            }
            return
        }

        // Fetch from network
        guard let url = URL(string: urlString) else { return }
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let http = response as? HTTPURLResponse,
                  (200...299).contains(http.statusCode) else { return }
            try? data.write(to: diskPath, options: .atomic)
            touch(fileURL: diskPath)
            enforceDiskLimit()

            if let img = downsampledImage(at: diskPath) {
                let cost = imageCost(img)
                memoryCache.setObject(img, forKey: key as NSString, cost: cost)
            }
        } catch {
            // Prefetch is best-effort — silently ignore failures
        }
    }

    /// Trim disk cache on startup. Call once at app launch.
    /// If cache exceeds the high-water mark, trim down to the low-water mark
    /// so we aren't constantly at capacity.
    func trimDiskCacheOnStartup() {
        let highWater = maxDiskBytes * 80 / 100  // 80 MB
        let lowWater  = maxDiskBytes * 60 / 100  // 60 MB

        let keys: Set<URLResourceKey> = [.isRegularFileKey, .fileSizeKey, .contentModificationDateKey]
        guard let enumerator = FileManager.default.enumerator(
            at: diskDirectory,
            includingPropertiesForKeys: Array(keys)
        ) else { return }

        var files: [(url: URL, size: Int, modified: Date)] = []
        var totalSize = 0

        for case let url as URL in enumerator {
            guard let values = try? url.resourceValues(forKeys: keys),
                  values.isRegularFile == true,
                  let size = values.fileSize else { continue }
            let modified = values.contentModificationDate ?? .distantPast
            files.append((url, size, modified))
            totalSize += size
        }

        guard totalSize > highWater else { return }

        #if DEBUG
        print("[ImageCache] Startup trim: \(totalSize / 1024 / 1024)MB > \(highWater / 1024 / 1024)MB threshold")
        #endif

        for file in files.sorted(by: { $0.modified < $1.modified }) {
            try? FileManager.default.removeItem(at: file.url)
            totalSize -= file.size
            if totalSize <= lowWater { break }
        }

        #if DEBUG
        print("[ImageCache] Trimmed to \(totalSize / 1024 / 1024)MB")
        #endif
    }

    /// Remove all cached images.
    func clearAll() {
        memoryCache.removeAllObjects()
        try? FileManager.default.removeItem(at: diskDirectory)
        try? FileManager.default.createDirectory(at: diskDirectory, withIntermediateDirectories: true)
    }

    // MARK: - Downsampling

    /// Downsample an image file to at most `maxPixelSize` on its longest edge.
    /// Uses ImageIO to decode only the thumbnail-sized bitmap, avoiding the
    /// full-resolution decode that UIImage(data:) performs.
    private func downsampledImage(at fileURL: URL) -> UIImage? {
        let options: [CFString: Any] = [
            kCGImageSourceShouldCache: false   // Don't cache the full-size CGImage
        ]
        guard let source = CGImageSourceCreateWithURL(fileURL as CFURL, options as CFDictionary) else {
            return nil
        }

        let thumbOptions: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
            kCGImageSourceCreateThumbnailWithTransform: true,  // Respect EXIF orientation
            kCGImageSourceShouldCacheImmediately: true         // Decode bitmap right away
        ]
        guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, thumbOptions as CFDictionary) else {
            return nil
        }

        return UIImage(cgImage: cgImage)
    }

    /// Approximate decoded memory cost in bytes (width * height * 4 bytes per pixel).
    private func imageCost(_ image: UIImage) -> Int {
        guard let cg = image.cgImage else { return 0 }
        return cg.width * cg.height * 4
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
    @State private var fromCache = false

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
                    .transition(.opacity)
            } else {
                placeholder()
                    .transition(.opacity)
            }
        }
        .animation(.easeIn(duration: fromCache ? 0 : 0.3), value: uiImage != nil)
        .task(id: urlString) {
            guard let urlString else {
                isLoading = false
                return
            }
            isLoading = true
            // Check if already in memory cache (instant, no fade needed)
            let startedFromCache = await ImageCache.shared.isInMemory(urlString)
            let loaded = await ImageCache.shared.image(for: urlString)
            fromCache = startedFromCache
            withAnimation(startedFromCache ? nil : .easeIn(duration: 0.3)) {
                uiImage = loaded
            }
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

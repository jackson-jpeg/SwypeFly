import Foundation

/// Converts USD amounts to the device's local currency using hardcoded exchange rates.
/// Returns nil if the device currency is already USD.
enum CurrencyHelper {

    // MARK: - Hardcoded exchange rates (1 USD = X local)
    // Last updated: 2026-03-25. Update periodically.
    private static let rates: [String: Double] = [
        "EUR": 0.92,
        "GBP": 0.79,
        "JPY": 150.5,
        "CAD": 1.36,
        "AUD": 1.54,
        "CHF": 0.88,
        "CNY": 7.24,
        "INR": 83.5,
        "MXN": 17.1,
        "BRL": 4.97,
        "KRW": 1335.0,
        "SEK": 10.45,
        "NOK": 10.55,
        "DKK": 6.88,
        "NZD": 1.67,
        "SGD": 1.34,
        "HKD": 7.83,
        "THB": 35.6,
        "ZAR": 18.7,
        "PLN": 3.98,
        "CZK": 23.1,
        "HUF": 365.0,
        "ILS": 3.65,
        "TWD": 31.5,
        "TRY": 32.2,
        "AED": 3.67,
        "SAR": 3.75,
        "PHP": 56.2,
        "MYR": 4.72,
        "IDR": 15800.0,
        "VND": 24500.0,
        "COP": 3950.0,
        "ARS": 870.0,
        "CLP": 940.0,
        "PEN": 3.72,
        "EGP": 30.9,
        "NGN": 1550.0,
        "KES": 153.0,
        "PKR": 278.0,
        "BDT": 110.0,
        "UAH": 37.5,
        "RON": 4.59,
        "BGN": 1.80,
        "HRK": 6.93,
        "ISK": 137.0,
        "QAR": 3.64,
        "KWD": 0.31,
        "BHD": 0.38,
        "OMR": 0.39,
        "JOD": 0.71,
        "MAD": 10.0,
        "RUB": 92.0,
    ]

    /// The device's local currency code, derived from the current locale.
    static var deviceCurrencyCode: String {
        Locale.current.currency?.identifier ?? "USD"
    }

    /// Converts a USD amount to the device's local currency.
    /// Returns a formatted string like "~EUR265" or nil if the device uses USD
    /// or the currency is unsupported.
    static func convertFromUSD(amount: Double) -> String? {
        let code = deviceCurrencyCode
        guard code != "USD" else { return nil }
        guard let rate = rates[code] else { return nil }

        let converted = amount * rate

        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = code
        formatter.maximumFractionDigits = converted >= 100 ? 0 : 2
        formatter.locale = Locale.current

        guard let formatted = formatter.string(from: NSNumber(value: converted)) else {
            return nil
        }
        return "~\(formatted)"
    }
}

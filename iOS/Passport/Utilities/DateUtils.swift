import Foundation

func dateFromString(date: String) -> Date {
    let dateFormatter = DateFormatter()
    dateFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm"
    let date = dateFormatter.date(from: date) ?? Date.now
    return date
}

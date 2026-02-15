import Foundation

struct Event {
    var id: String
    var title: String
    var date: String
    var location: String
    var descriptionLink: String
}

extension Event: Decodable {
    enum CodingKeys: String, CodingKey {
        case id = "id"
        case title = "title"
        case date = "date"
        case location = "location"
        case descriptionLink = "descriptionLink"
    }
    init(from decoder: Decoder) throws {
        let podcastContainer = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try podcastContainer.decode(String.self, forKey: .id)
        self.title = try podcastContainer.decode(String.self, forKey: .title)
        self.date = try podcastContainer.decode(String.self, forKey: .date)
        self.location = try podcastContainer.decode(String.self, forKey: .location)
        self.descriptionLink = try podcastContainer.decode(String.self, forKey: .descriptionLink)
    }
}

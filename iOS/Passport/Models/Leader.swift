import Foundation

struct Leader {
    var id: String
    var eventsAttended: Int64
    var username: String
}

extension Leader: Decodable {
    enum CodingKeys: String, CodingKey {
        case id = "id"
        case eventsAttended = "eventsAttended"
        case username = "username"
    }
    init(from decoder: Decoder) throws {
        let podcastContainer = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try podcastContainer.decode(String.self, forKey: .id)
        self.eventsAttended = try podcastContainer.decode(Int64.self, forKey: .eventsAttended)
        self.username = (try? podcastContainer.decode(String.self, forKey: .username)) ?? ""
    }
}

struct Leaders {
    var features: [Leader]
}

extension Leaders: Decodable {
    enum CodingKeys: String, CodingKey {
        case features = "features"
    }
    init(from decoder: Decoder) throws {
        let podcastContainer = try decoder.container(keyedBy: CodingKeys.self)
        self.features = try podcastContainer.decode([Leader].self, forKey: .features)
    }
}

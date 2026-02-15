import Foundation

struct Message {
    var message: String
    var title: String
}

extension Message: Decodable {
    enum CodingKeys: String, CodingKey {
        case message = "message"
        case title = "title"
    }
    init(from decoder: Decoder) throws {
        let podcastContainer = try decoder.container(keyedBy: CodingKeys.self)
        self.message = try podcastContainer.decode(String.self, forKey: .message)
        self.title = try podcastContainer.decode(String.self, forKey: .title)
    }
}

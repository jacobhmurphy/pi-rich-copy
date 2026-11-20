import AppKit
import Foundation

struct ClipboardPayload: Decodable {
    let plainText: String
    let html: String
}

let input = FileHandle.standardInput.readDataToEndOfFile()
let payload = try JSONDecoder().decode(ClipboardPayload.self, from: input)
let pasteboard = NSPasteboard.general
pasteboard.clearContents()

guard pasteboard.setString(payload.html, forType: .html) else {
    throw NSError(domain: "omp-rich-copy", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not write HTML to the pasteboard"])
}
guard pasteboard.setString(payload.plainText, forType: .string) else {
    throw NSError(domain: "omp-rich-copy", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not write plain text to the pasteboard"])
}

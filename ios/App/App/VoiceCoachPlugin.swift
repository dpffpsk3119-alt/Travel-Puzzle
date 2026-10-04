import Foundation
import AVFoundation
import Speech
import Capacitor

/// 따라 말하기 코치용 플러그인
///  - synth: 아이폰 음성으로 원어민 문장을 WAV로 만들어 돌려줘요 (억양 비교 기준)
///  - recognize: 아이가 녹음한 소리(16kHz PCM)를 글자로 바꿔요
@objc(VoiceCoachPlugin)
public class VoiceCoachPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VoiceCoachPlugin"
    public let jsName = "VoiceCoach"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "synth", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recognize", returnType: CAPPluginReturnPromise)
    ]

    private let synthesizer = AVSpeechSynthesizer()
    private var task: SFSpeechRecognitionTask?

    @objc func synth(_ call: CAPPluginCall) {
        let text = call.getString("text") ?? ""
        let lang = call.getString("lang") ?? "en-US"
        let rate = call.getFloat("rate") ?? 0.9
        guard let voice = AVSpeechSynthesisVoice(language: lang) else { call.reject("language not installed"); return }
        let u = AVSpeechUtterance(string: text)
        u.voice = voice
        u.rate = AVSpeechUtteranceDefaultSpeechRate * rate

        var samples: [Float] = []
        var sampleRate: Double = 22050
        var finished = false
        let lock = NSLock()
        let finish: () -> Void = {
            lock.lock(); defer { lock.unlock() }
            if finished { return }
            finished = true
            if samples.isEmpty { call.reject("synth failed"); return }
            call.resolve(["wav": VoiceCoachPlugin.wav(samples, Int(sampleRate)).base64EncodedString()])
        }
        DispatchQueue.main.async {
            self.synthesizer.write(u) { buffer in
                guard let pcm = buffer as? AVAudioPCMBuffer else { return }
                if pcm.frameLength == 0 { finish(); return }
                sampleRate = pcm.format.sampleRate
                let n = Int(pcm.frameLength)
                if let ch = pcm.floatChannelData {
                    samples.append(contentsOf: UnsafeBufferPointer(start: ch[0], count: n))
                } else if let ch = pcm.int16ChannelData {
                    samples.append(contentsOf: UnsafeBufferPointer(start: ch[0], count: n).map { Float($0) / 32768 })
                }
            }
        }
        // 어떤 iOS는 끝 신호(빈 버퍼)를 안 보내서 넉넉히 기다린 뒤 마무리해요
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { finish() }
    }

    @objc func recognize(_ call: CAPPluginCall) {
        let lang = call.getString("lang") ?? "en-US"
        let sr = call.getInt("sr") ?? 16000
        guard let b64 = call.getString("pcm"), let pcm = Data(base64Encoded: b64) else { call.reject("no audio"); return }
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized, let rec = SFSpeechRecognizer(locale: Locale(identifier: lang)), rec.isAvailable else {
                call.reject("unavailable"); return
            }
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".wav")
            do { try VoiceCoachPlugin.wavHeader(pcmBytes: pcm.count, sr: sr).appending(pcm).write(to: url) } catch { call.reject("write failed"); return }
            let req = SFSpeechURLRecognitionRequest(url: url)
            req.shouldReportPartialResults = false
            var done = false
            DispatchQueue.main.async {
                self.task = rec.recognitionTask(with: req) { res, err in
                    if done { return }
                    if let r = res, r.isFinal {
                        done = true
                        call.resolve(["texts": r.transcriptions.map { $0.formattedString }])
                        try? FileManager.default.removeItem(at: url)
                    } else if err != nil {
                        done = true
                        call.reject("recognize failed")
                        try? FileManager.default.removeItem(at: url)
                    }
                }
            }
        }
    }

    static func wavHeader(pcmBytes: Int, sr: Int) -> Data {
        var d = Data()
        func s(_ t: String) { d.append(t.data(using: .ascii)!) }
        func u32(_ v: UInt32) { var x = v.littleEndian; d.append(Data(bytes: &x, count: 4)) }
        func u16(_ v: UInt16) { var x = v.littleEndian; d.append(Data(bytes: &x, count: 2)) }
        s("RIFF"); u32(UInt32(36 + pcmBytes)); s("WAVE"); s("fmt "); u32(16); u16(1); u16(1)
        u32(UInt32(sr)); u32(UInt32(sr * 2)); u16(2); u16(16); s("data"); u32(UInt32(pcmBytes))
        return d
    }

    static func wav(_ x: [Float], _ sr: Int) -> Data {
        var pcm = Data(capacity: x.count * 2)
        for v in x {
            var q = Int16(max(-1, min(1, v)) * 32767).littleEndian
            pcm.append(Data(bytes: &q, count: 2))
        }
        return wavHeader(pcmBytes: pcm.count, sr: sr).appending(pcm)
    }
}

private extension Data {
    func appending(_ other: Data) -> Data { var d = self; d.append(other); return d }
}

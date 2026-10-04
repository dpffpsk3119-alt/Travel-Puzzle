import UIKit
import Capacitor

/// 앱 화면: 우리가 만든 플러그인(따라 말하기 코치)을 등록해요
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(VoiceCoachPlugin())
    }
}

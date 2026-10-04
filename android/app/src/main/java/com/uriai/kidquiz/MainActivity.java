package com.uriai.kidquiz;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VoiceCoachPlugin.class);   // 따라 말하기 코치 (원어민 소리 만들기·음성 인식)
        super.onCreate(savedInstanceState);
    }
}

package com.uriai.kidquiz;

import android.content.Intent;
import android.media.AudioFormat;
import android.os.Build;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 따라 말하기 코치용 플러그인
 *  - synth: 휴대폰 음성 엔진으로 원어민 문장을 WAV 파일로 만들어 돌려줘요 (억양 비교 기준)
 *  - recognize: 아이가 녹음한 소리(16kHz PCM)를 글자로 바꿔요 (안드로이드 13 이상)
 */
@CapacitorPlugin(name = "VoiceCoach")
public class VoiceCoachPlugin extends Plugin {
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private final List<Runnable> waiting = new ArrayList<>();

    @Override
    public void load() {
        tts = new TextToSpeech(getContext(), status -> {
            ttsReady = status == TextToSpeech.SUCCESS;
            List<Runnable> jobs = new ArrayList<>(waiting);
            waiting.clear();
            for (Runnable r : jobs) r.run();
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) tts.shutdown();
    }

    @PluginMethod
    public void synth(PluginCall call) {
        final String text = call.getString("text", "");
        final String lang = call.getString("lang", "en-US");
        final float rate = call.getFloat("rate", 0.9f);
        Runnable job = () -> {
            if (!ttsReady) { call.reject("tts not ready"); return; }
            Locale loc = Locale.forLanguageTag(lang);
            if (tts.isLanguageAvailable(loc) < TextToSpeech.LANG_AVAILABLE) { call.reject("language not installed"); return; }
            try {
                tts.setLanguage(loc);
                tts.setSpeechRate(rate);
                final File f = File.createTempFile("ref", ".wav", getContext().getCacheDir());
                final String id = UUID.randomUUID().toString();
                final AtomicBoolean done = new AtomicBoolean(false);
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String u) {}
                    @Override public void onDone(String u) {
                        if (!id.equals(u) || done.getAndSet(true)) return;
                        try {
                            byte[] b = readAll(f);
                            //noinspection ResultOfMethodCallIgnored
                            f.delete();
                            JSObject r = new JSObject();
                            r.put("wav", Base64.encodeToString(b, Base64.NO_WRAP));
                            call.resolve(r);
                        } catch (Exception e) { call.reject("read failed"); }
                    }
                    @Override public void onError(String u) { if (id.equals(u) && !done.getAndSet(true)) call.reject("synth failed"); }
                    @Override public void onError(String u, int code) { onError(u); }
                });
                int res = tts.synthesizeToFile(text, new Bundle(), f, id);
                if (res != TextToSpeech.SUCCESS && !done.getAndSet(true)) call.reject("synth failed");
            } catch (Exception e) { call.reject("synth failed"); }
        };
        if (ttsReady) job.run(); else waiting.add(job);
    }

    @PluginMethod
    public void recognize(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || !SpeechRecognizer.isRecognitionAvailable(getContext())) { call.reject("unavailable"); return; }
        final String lang = call.getString("lang", "en-US");
        final byte[] pcm = Base64.decode(call.getString("pcm", ""), Base64.DEFAULT);
        final int sr = call.getInt("sr", 16000);
        getActivity().runOnUiThread(() -> {
            try {
                final ParcelFileDescriptor[] pipe = ParcelFileDescriptor.createPipe();
                new Thread(() -> {
                    try (OutputStream os = new ParcelFileDescriptor.AutoCloseOutputStream(pipe[1])) { os.write(pcm); } catch (Exception ignored) {}
                }).start();
                final SpeechRecognizer rec = SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext())
                        ? SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext())
                        : SpeechRecognizer.createSpeechRecognizer(getContext());
                final AtomicBoolean done = new AtomicBoolean(false);
                Intent it = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                it.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                it.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
                it.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
                it.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE, pipe[0]);
                it.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_CHANNEL_COUNT, 1);
                it.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_ENCODING, AudioFormat.ENCODING_PCM_16BIT);
                it.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_SAMPLING_RATE, sr);
                rec.setRecognitionListener(new RecognitionListener() {
                    @Override public void onResults(Bundle b) {
                        if (done.getAndSet(true)) return;
                        ArrayList<String> list = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        JSObject r = new JSObject();
                        r.put("texts", new JSArray(list == null ? new ArrayList<String>() : list));
                        call.resolve(r);
                        rec.destroy();
                    }
                    @Override public void onError(int error) { if (!done.getAndSet(true)) { call.reject("error " + error); rec.destroy(); } }
                    @Override public void onReadyForSpeech(Bundle b) {}
                    @Override public void onBeginningOfSpeech() {}
                    @Override public void onRmsChanged(float v) {}
                    @Override public void onBufferReceived(byte[] bytes) {}
                    @Override public void onEndOfSpeech() {}
                    @Override public void onPartialResults(Bundle b) {}
                    @Override public void onEvent(int i, Bundle b) {}
                });
                rec.startListening(it);
            } catch (Exception e) { call.reject("recognize failed"); }
        });
    }

    private static byte[] readAll(File f) throws Exception {
        try (InputStream in = new FileInputStream(f); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192]; int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        }
    }
}

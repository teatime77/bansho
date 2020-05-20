/// <reference path="main.ts" />
namespace bansho {
export let isSpeaking = false;
let voiceList: string[]|null = null;
let jpVoice : SpeechSynthesisVoice|null = null;
let prevIdx = 0;
let voiceName = "Google 日本語";
// let voiceName = "Microsoft Haruka Desktop - Japanese";

function setVoice(){
    const voices = speechSynthesis.getVoices()
    voiceList = [];
    voices.forEach(voice => { //　アロー関数 (ES6)
        msg(`${voice.lang} [${voice.name}] ${voice.default} ${voice.localService} ${voice.voiceURI}`);


        if(voice.name == voiceName){
            msg(`set jp voice[${voice.name}]`);
            jpVoice = voice;
        }
        if(jpVoice == null && (voice.lang == "ja-JP" || voice.lang == "ja_JP")){
            msg(`set jp voice[${voice.name}]`);
            jpVoice = voice;
        }
        voiceList!.push(voice.name);
    });
}

export function initSpeech(){
    if ('speechSynthesis' in window) {
        msg("このブラウザは音声合成に対応しています。🎉");
    }
    else {
        msg("このブラウザは音声合成に対応していません。😭");
    }    

    speechSynthesis.onvoiceschanged = function(){
        msg("voices changed");
        setVoice();
    };
}

export function* speak(act: SpeechAction){
    if(voiceList == null){
        setVoice();
    }

    let [caption, speech] = act.getCaptionSpeech();

    if(act.ui.caption != undefined){
        act.ui.caption.textContent = caption;
        reprocessMathJax(act, act.ui.caption, caption);
    }

    const uttr = new SpeechSynthesisUtterance(speech);

    if(jpVoice != null){
        uttr.voice = jpVoice;
    }

    isSpeaking = true;
    uttr.onend = function(ev: SpeechSynthesisEvent ) {
        isSpeaking = false;
        msg(`end: idx:${ev.charIndex} name:${ev.name} type:${ev.type} text:${ev.utterance.text.substring(prevIdx, ev.charIndex)}`);
    };

    uttr.onboundary = function(ev: SpeechSynthesisEvent ) { 
        msg(`bdr: idx:${ev.charIndex} name:${ev.name} type:${ev.type} text:${ev.utterance.text.substring(prevIdx, ev.charIndex)}`);
        prevIdx = ev.charIndex;
    };

    speechSynthesis.speak(uttr);

    while(isSpeaking){
        yield;
    }
}

export function cancelSpeech(){
    if(isSpeaking){
        speechSynthesis.cancel();
    }
}

}
/// <reference path="main.ts" />
namespace tekesan {
export let isSpeaking = false;
let voiceList = null;
let jpVoice : SpeechSynthesisVoice = null;
let prevIdx = 0;
let voiceName = "Google 日本語";
// let voiceName = "Microsoft Haruka Desktop - Japanese";

function setVoice(){
    const voices = speechSynthesis.getVoices()
    voiceList = [];
    voices.forEach(voice => { //　アロー関数 (ES6)
        msg(`${voice.lang} [${voice.name}] ${voice.default} ${voice.localService} ${voice.voiceURI}`);


        if(voice.name == voiceName){
            msg("set Haruka voice");
            jpVoice = voice;
        }
        if(jpVoice == null && (voice.lang == "ja-JP" || voice.lang == "ja_JP")){
            msg(`set jp voice[${voice.name}]`);
            jpVoice = voice;
        }
        voiceList.push(voice.name);
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

export function* speak(text: string){
    if(voiceList == null){
        setVoice();
    }

    let caption = "";
    let speech = "";
    let st = 0;
    while(st < text.length){
        let k1 = text.indexOf("'", st);
        if(k1 == -1){
            caption += text.substring(st);
            speech  += text.substring(st);
            break;
        }

        caption += text.substring(st, k1);
        speech  += text.substring(st, k1);

        k1++;
        let k2 = text.indexOf("'", k1);
        if(k2 == -1){

            caption += text.substring(st);
            speech  += text.substring(st);
            break;
        }

        let v = text.substring(k1, k2).split("|");
        if(v.length != 2){

            let s = text.substring(k1 - 1, k2 + 1)
            
            caption += s;
            speech  += s;
        }
        else{

            caption += v[0];
            speech  += v[1];
        }

        st = k2 + 1;
    }

    if(ui.caption != undefined){
        ui.caption.textContent = caption;
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
// import { msg, tostr } from "./util";
// import { TextWidget } from "./widget";
// import { reprocessMathJax } from "./event";
// import { glb } from "./main";

namespace bansho {
export let isSpeaking = false;
let voiceList: string[]|null = null;
let jpVoice : SpeechSynthesisVoice|null = null;
let prevIdx = 0;
let voiceName = "Google 日本語";
// let voiceName = "Microsoft Haruka Desktop - Japanese";

export class SpeechWidget extends TextWidget {

    constructor(text: string){
        super(text);
    }

    toStr() : string {
        return `{ "type": "speech", "text":${tostr(this.text)} }`;
    }

    *play(){
        this.enable();
        yield* speak(this);
    }

    summary() : string {
        return "音声";
    }

    getCaptionSpeech(): [string, string]{
        let caption = "";
        let speech = "";
        let st = 0;
        while(st < this.text.length){
            let k1 = this.text.indexOf("'", st);
            if(k1 == -1){
                caption += this.text.substring(st);
                speech  += this.text.substring(st);
                break;
            }
    
            caption += this.text.substring(st, k1);
            speech  += this.text.substring(st, k1);
    
            k1++;
            let k2 = this.text.indexOf("'", k1);
            if(k2 == -1){
    
                caption += this.text.substring(st);
                speech  += this.text.substring(st);
                break;
            }
    
            let v = this.text.substring(k1, k2).split("|");
            if(v.length != 2){
    
                let s = this.text.substring(k1 - 1, k2 + 1)
                
                caption += s;
                speech  += s;
            }
            else{
    
                caption += v[0];
                speech  += v[1];
            }
    
            st = k2 + 1;
        }

        return[caption, speech];
    }
}

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

export function* speak(act: SpeechWidget) : any {
    if(voiceList == null){
        setVoice();
    }

    let [caption, speech] = act.getCaptionSpeech();

    if(glb.caption != undefined){
        glb.caption.textContent = caption;
        reprocessMathJax(act, glb.caption, caption);
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
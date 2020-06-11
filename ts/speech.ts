namespace bansho {
let voiceList: string[]|null = null;
let jpVoice : SpeechSynthesisVoice|null = null;
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

export function speak(act: Speech) : any {
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

    glb.isSpeaking = true;
    setSpeechEventListener(uttr);

    speechSynthesis.speak(uttr);
}

}
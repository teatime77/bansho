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

export class Speech extends TextWidget {
    static pendigWidget : ShapeSelection | null = null;
    static pause : number = 0;
    static nextPos : number = 0;
    static timePos : number;
    static subPos : number = 0;

    prevCharIndex = 0;

    constructor(text: string){
        super(text);
    }

    summary() : string {
        return `🔊 ${this.Text}`;
    }

    splitCaptionSpeech(splitPhrase: boolean): [string, string]{
        let text: string;

        if(splitPhrase){

            let i1 = this.Text.indexOf(",,", Speech.nextPos);
            if(i1 != -1){

                text = this.Text.substring(Speech.nextPos, i1);
            }
            else{
                text = this.Text.substring(Speech.nextPos);
            }
        }
        else{
            text = this.Text.replace(/,,/g, " ");
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

        return[caption, speech];
    }

    startSpeak(start: boolean){
        if(start){

            Speech.nextPos = 0;
            Speech.timePos = getTimePos();

            Speech.pendigWidget = null;
        }

        let [caption, speech] = this.splitCaptionSpeech(true);

        this.getPhrase();
        this.speak(caption, speech);

        if(Speech.pause == 0){

            if(Speech.pendigWidget != null){
                let act = Speech.pendigWidget;
                while(Speech.subPos < act.shapes.length){
                    act.shapes[Speech.subPos].select(true);
                    Speech.subPos++;
                }
                Speech.pendigWidget = null;
            }
        }
        else{

            for(let idx = 0; idx < Speech.pause; idx++){

                let act : Widget
                if(Speech.pendigWidget == null){
                    Speech.timePos++;
                    if(Speech.timePos < glb.widgets.length){

                        act = glb.widgets[Speech.timePos];
                        Speech.subPos = 0;
                    }
                    else{
                        throw new Error();
                    }
                }
                else{
                    act = Speech.pendigWidget;
                }
                if(act instanceof ShapeSelection){
                    act.shapes[Speech.subPos].select(true);
                    console.log(`select ${Speech.subPos}`);

                    Speech.subPos++;
                    if(Speech.subPos < act.shapes.length){
                        Speech.pendigWidget = act;
                    }
                    else{
                        Speech.pendigWidget = null;
                    }
                }
            }
        }
    }

    getPhrase(){
        let i1 = this.Text.indexOf(",,", Speech.nextPos);
        if(i1 != -1){

            let i2 = i1 + 2;
            while(i2 < this.Text.length && this.Text[i2] == ','){
                i2++;
            }

            Speech.nextPos = i2;
            Speech.pause = i2 - 1 - i1;
        }
        else{

            Speech.nextPos = this.Text.length;
            Speech.pause = 0;
        }
    }

    speak(caption : string, speech : string) : any {
        if(voiceList == null){
            setVoice();
        }


        console.log(`speak caption:${caption}`);
    
        if(glb.caption != undefined){
            glb.caption.textContent = caption;
            reprocessMathJax(this, glb.caption, caption);
        }
    
        const uttr = new SpeechSynthesisUtterance(speech);
    
        if(jpVoice != null){
            uttr.voice = jpVoice;
        }
    
        glb.isSpeaking = true;
        setSpeechEventListener(this, uttr);
    
        speechSynthesis.speak(uttr);
    }
    
    onSpeechBoundary(ev: SpeechSynthesisEvent){
        msg(`speech bdr: idx:${ev.charIndex} name:${ev.name} type:${ev.type} text:${ev.utterance.text.substring(this.prevCharIndex, ev.charIndex)}`);
        this.prevCharIndex = ev.charIndex;
    }

    onSpeechEnd = (ev: SpeechSynthesisEvent)=>{
        glb.isSpeaking = false;
        msg(`speech end: idx:${ev.charIndex} name:${ev.name} type:${ev.type} text:${ev.utterance.text.substring(this.prevCharIndex, ev.charIndex)}`);

        // テキストの選択を無効にする。
        Array.from(TemporarySelections).forEach(x => x.disable());
        console.assert(TemporarySelections.length == 0);

        // 図形の選択を無効にする。
        deselectShape();

        if(glb.pauseFlag){
    
            glb.pauseFlag = false;
            glb.showPlayButton();
        }
        else{

            if(Speech.nextPos < this.Text.length){

                this.startSpeak(false);
            }
            else{
                setTimePos(Speech.timePos);

                glb.playWidgets();
            }
        }
    }
}


}
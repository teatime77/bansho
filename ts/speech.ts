namespace bansho {
let voiceList: string[]|null = null;
let jpVoice : SpeechSynthesisVoice|null = null;
let voiceName = "Google 日本語";
// let voiceName = "Microsoft Haruka Desktop - Japanese";

let pattern  = / @(,+)?(?:t([.\d]*))?(?:([A-Z])([0-9]+))?(\s|$)/;
let patternG = / @(,+)?(?:t([.\d]*))?(?:([A-Z])([0-9]+))?(\s|$)/g;

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
    static span : number = 0;
    static nextPos : number = 0;
    static duration : number;
    static startTime : number;
    static speechIdx : number;
    static attentionId : string;
    static attentionIdx : number;
    static lookahead : Widget[] = [];
    static temporaries : Widget[] = [];
    static viewPoint : ViewPoint | null = null;
    static timer : number | null = null;

    prevCharIndex = 0;

    constructor(text: string){
        super(text);
    }

    summary() : string {
        let i = glb.widgets.filter(x => x instanceof Speech).indexOf(this);
        return `🔊${i} ${this.Text}`;
    }

    splitCaptionSpeech(splitPhrase: boolean): [string, string]{
        let text: string;

        if(splitPhrase){

            Speech.duration = 0;
            Speech.span = 0;
            Speech.attentionId = "";
            Speech.attentionIdx = -1;

            let nextText = this.Text.substring(Speech.nextPos);
            let found = nextText.match(pattern);

            if(found == null){

                text = nextText;
                Speech.nextPos = this.Text.length;
            }
            else{
                text = nextText.substring(0, found.index);

                if(found[1] != undefined){
                    // カンマ(,)がある場合
    
                    Speech.span = found[1].length;
                }
    
                if(found[2] != undefined){
                    // 時間指定がある場合

                    Speech.duration = parseFloat(found[2]);
                    if(isNaN(Speech.duration)){
                        throw new Error();
                    }
                }
    
                if(found[3] != undefined){
                    // アテンション指定がある場合

                    Speech.attentionId = found[3];
                    Speech.attentionIdx = parseInt(found[4]);
                    console.log(`attention ${Speech.attentionIdx}`);
                    if(isNaN(Speech.attentionIdx)){
                        throw new Error();
                    }
                }

                Speech.nextPos += found.index! + found[0].length;
            }
        }
        else{
            text = this.Text.replace(patternG, " ");
            Speech.nextPos = this.Text.length;
        }

        let yomi = [
            [ /\ssin\s/g, "`sin|サイン`" ],
            [ /\scos\s/g, "`cos|コサイン`" ],
            [ /\s-\s/g, "`-|マイナス`" ],
            [ /\s項\s/g, "`項|こう`" ],
            [ /\s角\s/g, "`角|カク`" ],
            [ /\s辺\s/g, "`辺|ヘン`" ],
        ]

        for(let [r, s] of yomi){
            text = text.replace(r, s as string);
        }

        // `漢字|読み`をcaptionとspeechに分ける。
        let caption = "";
        let speech = "";
    
        while(true){
            let f = text.match(/`([^|]+)\|([^`]+)`/);
            if(f == null){
                caption += text;
                speech  += text;
                break;
            }
    
            let s = text.substring(0, f.index);
            caption += s + f[1];
            speech  += s + f[2];
    
            text = text.substring(f.index! + f[0].length);
        }

        return[caption, speech];
    }

    startSpeak(start: boolean){
        deselectShape();
        if(start){

            Speech.nextPos = 0;

            Speech.lookahead = [];
            Speech.temporaries = [];
            for(let pos = getTimelinePos() + 1; pos < glb.widgets.length; pos++){
                let act = glb.widgets[pos];
                if(act instanceof Speech){
                    break;
                }
                else if(act instanceof WidgetSelection){
                    Speech.lookahead.push(... act.selections.map(x => WidgetSelection.one(x)))
                }
                else{
                    Speech.lookahead.push(act);
                }
            }

            Speech.speechIdx = 10 * glb.widgets.filter(x => x instanceof Speech).indexOf(this);
        }
        else{
            Speech.speechIdx++;
        }

        let [caption, speech] = this.splitCaptionSpeech(true);

        this.speak(caption, speech);
        Speech.startTime = (new Date()).getTime();
        if(Glb.startPlayTime != 0 && glb.playTime != null){
            let t = Math.round((Speech.startTime - Glb.startPlayTime) / 1000);
            glb.playTime.innerText = `${Math.floor(t / 60)}:${t % 60}`;
        }

        glb.widgets.forEach(x => { if(x instanceof Point) x.checkEndTime(); });

        if(Speech.span == 0 && Speech.nextPos == this.Text.length){
            // スピーチが分割されないか、最後のフレーズの場合

            Speech.span = Speech.lookahead.length;
        }
        else{

            Speech.span = Math.min(Speech.span, Speech.lookahead.length);
        }

        Speech.viewPoint = null;
        for(let idx = 0; idx < Speech.span; idx++){
            let act = Speech.lookahead.shift()!;

            if(act instanceof ViewPoint){

                Speech.viewPoint = act;
            }

            act.enable();

            if(act instanceof WidgetSelection && ! (act.selections[0] instanceof TextSelection && act.selections[0].type != SelectionType.temporary)){
                
                Speech.temporaries.push(act);
            }
        }
    }

    speak(caption : string, speech : string) : any {
        if(voiceList == null){
            setVoice();
        }

        console.log(`🔊 ${Speech.speechIdx} ${caption}`);
    
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

        // 図形の選択を無効にする。
        console.log(`一次選択 ${Speech.temporaries.length}`);
        Speech.temporaries.forEach(x => x.disable());
        Speech.temporaries = [];

        Speech.viewPoint = null;

        if(glb.pauseFlag){
    
            glb.pauseFlag = false;
            glb.showPlayButton();
        }
        else{

            let waitTime = 1000 * Speech.duration - ((new Date()).getTime() - Speech.startTime);
            let pause = Glb.edit ? 0 : (this.Text.length <= Speech.nextPos && this.Text.endsWith("。") ? 3000 : 0);
            Speech.timer = setTimeout(()=>{
                Speech.timer = null;
                
                if(Speech.nextPos < this.Text.length){

                    this.startSpeak(false);
                }
                else{
                    // 次のSpeechの位置
                    
                    for(let pos = getTimelinePos() + 1; pos < glb.widgets.length; pos++){
                        let act = glb.widgets[pos]

                        if(act instanceof Speech){

                            glb.updateTimePos(pos, true, false);
                            act.startSpeak(true);
                            return;
                        }
                    }

                    glb.onPlayComplete();
                }
            }, Math.max(pause, waitTime));
        }
    }
}


}
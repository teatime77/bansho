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
    static pendigShapeSelection : ShapeSelection | null = null;
    static span : number = 0;
    static nextPos : number = 0;
    static timelinePos : number;
    static subPos : number = 0;
    static duration : number;
    static startTime : number;
    static speechIdx : number;

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

            Speech.duration = 0;

            let nextText = this.Text.substring(Speech.nextPos);
            let found = nextText.match(/@(,+)?(?:t([.\d]*))?/);

            if(found == null || (found[1] == undefined && found[2] == undefined)){

                text = nextText;
            }
            else{
                text = nextText.substring(0, found.index);

                if(found[2] != undefined){
                    Speech.duration = parseFloat(found[2]);
                    if(isNaN(Speech.duration)){
                        throw new Error();
                    }
                }
            }
        }
        else{
            text = this.Text.replace( /(@,+(t[.\d]+)?)|(@t[.\d]+)/g, " ");
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
        deselectShape();
        if(start){

            Speech.nextPos = 0;
            Speech.timelinePos = getTimelinePos();

            Speech.pendigShapeSelection = null;

            Speech.speechIdx = 10 * glb.widgets.filter(x => x instanceof Speech).indexOf(this);
        }
        else{
            Speech.speechIdx++;
        }

        let [caption, speech] = this.splitCaptionSpeech(true);

        this.getPhrase();
        this.speak(caption, speech);
        Speech.startTime = (new Date()).getTime();

        if(Speech.span == 0){
            // スピーチが分割されないか、最後のフレーズの場合

            if(start){
                // スピーチの最初の場合

                // 次のスピーチの手前まで実行する。
                for(let pos = Speech.timelinePos + 1; pos < glb.widgets.length; pos++){
                    let act = glb.widgets[pos];
                    if(act instanceof Speech){    
                        return;
                    }
    
                    Speech.timelinePos = pos;
                    act.enable();    
                }    
            }
            else{
                // 2番目以降のフレーズの場合

                if(Speech.pendigShapeSelection != null){
                    // 処理の途中の図形選択がある場合

                    let act = Speech.pendigShapeSelection;
                    while(Speech.subPos < act.shapes.length){
                        act.shapes[Speech.subPos].select(true);
                        Speech.subPos++;
                    }
                    Speech.pendigShapeSelection = null;
                }
            }
        }
        else{
            // スピーチが分割され、最後のフレーズでない場合

            for(let idx = 0; idx < Speech.span; idx++){

                let act : Widget
                if(Speech.pendigShapeSelection == null){
                    // 処理の途中の図形選択がない場合

                    // 次の処理を得る。
                    Speech.timelinePos++;
                    if(Speech.timelinePos < glb.widgets.length){

                        act = glb.widgets[Speech.timelinePos];
                        Speech.subPos = 0;
                    }
                    else{
                        throw new Error();
                    }
                }
                else{
                    // 処理の途中の図形選択がある場合

                    act = Speech.pendigShapeSelection;
                }

                if(act instanceof ShapeSelection){
                    // 図形選択の場合

                    // 図形選択をする。
                    act.shapes[Speech.subPos].select(true);
                    console.log(`select ${Speech.subPos}`);

                    if(Speech.subPos + 1 < act.shapes.length){
                        // 続きがある場合

                        Speech.subPos++;
                        Speech.pendigShapeSelection = act;
                    }
                    else{
                        // 続きがない場合
                        
                        Speech.pendigShapeSelection = null;
                    }
                }
                else{
                    // 図形選択でない場合

                    // 処理を有効にする。
                    act.enable();
                }
            }
        }
    }

    getPhrase(){
        Speech.span = 0;

        let nextText = this.Text.substring(Speech.nextPos);
        let found = nextText.match(/@(,+)?(?:t([.\d]*))?/);
        if(found == null || (found[1] == undefined && found[2] == undefined)){

            Speech.nextPos = this.Text.length;
        }
        else{

            if(found[1] != undefined){

                Speech.span = found[1].length;
            }
            Speech.nextPos += found.index! + found[0].length;
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

            let waitTime = 1000 * Speech.duration - ((new Date()).getTime() - Speech.startTime);
            setTimeout(()=>{
                if(Speech.nextPos < this.Text.length){

                    this.startSpeak(false);
                }
                else{
                    setTimePos(Speech.timelinePos);
                    glb.playNextWidgets();
                }
            }, Math.max(0, waitTime));

        }
    }
}


}
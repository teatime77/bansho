import { msg, runGenerator, tostr, makeHtmlLines } from "./util";
// import { reprocessMathJax, UIEdit, onClickBlock, onPointerMove } from "./edit";
import { speak, cancelSpeech, isSpeaking, initSpeech } from "./speech";

// import { combineReducers } from '@reduxjs/toolkit'
// import { createSlice, configureStore } from '@types/react';

// namespace bansho {
declare let MathJax:any;

export const idPrefix = "bansho-id-";

export let colors : string[] = [ "magenta", "blue", "limegreen" ];

let typesetAct : Widget | null = null;

let typesetQue : [Widget, HTMLElement, string][] = [];

function popQue(){
    let div: HTMLElement;
    let text: string;

    if(typesetAct != null){
        // typesetの処理中の場合

        return;
    }

    while(typesetQue.length != 0){

        [typesetAct, div, text] = typesetQue.shift()!;
        div.textContent = text;

        if(text.includes("$")){

            MathJax.typesetPromise([div])
            .then(() => {
                if(typesetAct instanceof TextBlockWidget){
                    typesetAct.updateLineFeed();
                }
                typesetAct = null;

                if(typesetQue.length != 0){
                    popQue();
                }
            })
            .catch((err: any) => {
                console.log(err.message);
            });

            break;
        }
        else{

            typesetAct = null;
        }
    }
}

export function reprocessMathJax(act: Widget, div: HTMLDivElement | HTMLSpanElement, html: string){
    typesetQue.push([act, div, html]);
    popQue();
}

export class UI {
    actions : Widget[] = [];
    prevTimePos : number;
    pauseFlag : boolean;

    btnPlayPause: HTMLButtonElement;
    board : HTMLDivElement;
    timeline : HTMLInputElement;
    caption: HTMLSpanElement;

    isPlaying = false;
    selectColor : number = 0;

    constructor(div: HTMLDivElement){
        this.prevTimePos = -1;
        this.pauseFlag = false;

        this.btnPlayPause = document.createElement("button");
        this.btnPlayPause.disabled = true;
        this.btnPlayPause.style.fontFamily = "Segoe UI Emoji";
        this.btnPlayPause.style.fontSize = "40px";
        this.btnPlayPause.innerHTML = "⏹";
        div.appendChild(this.btnPlayPause);

        this.timeline = document.createElement("input");
        this.timeline.type = "range";
        this.timeline.min ="-1";
        this.timeline.max = "-1";
        this.timeline.value = "-1";
        this.timeline.step = "1";
        this.timeline.style.width = "100%";
        div.appendChild(this.timeline);

        this.board    = document.createElement("div");
        this.board.style.overflow = "scroll";
        this.board.style.borderStyle = "inset";
        this.board.style.borderWidth = "3px";
        div.appendChild(this.board);

        this.caption  = document.createElement("h3");
        this.caption.style.textAlign = "center";
        div.appendChild(this.caption);
    }

    setTextBlockEventListener(act: TextBlockWidget){}
        
    onOpenDocComplete = ()=>{
        this.btnPlayPause.disabled = false;
        this.btnPlayPause.innerHTML = "▶️";
    }  

    clickPlayPause(){
        if(this.isPlaying){
    
            this.btnPlayPause.disabled = true;
            pauseWidget(this, ()=>{
                this.btnPlayPause.disabled = false;
                this.btnPlayPause.innerHTML = "▶️";
            });
        }
        else{
    
            this.btnPlayPause.innerHTML = "⏸";
            this.playWidgets(()=>{
    
                this.btnPlayPause.innerHTML = "▶️";
                this.isPlaying = false;
            });
        }
        this.isPlaying = ! this.isPlaying;
        // document.getElementById("btn-play").style.display="none";
    }

    rngTimelineChange(){
        msg(`changed`);
        while(this.actions.some(x => x instanceof EmptyWidget)){
            let idx = this.actions.findIndex(x => x instanceof EmptyWidget);
            this.actions.splice(idx, 1);
        }
    
        this.prevTimePos = Math.min(this.prevTimePos, this.actions.length - 1);
        this.timeline.max = `${this.actions.length - 1}`;
        this.updateTimePos(this.timeline.valueAsNumber);
    }

    getWidgetById(id: number) : Widget {
        let act = this.actions.find(x => x.id == id);
        console.assert(act != undefined);

        return act!;
    }

    currentWidget() : Widget | undefined {
        if(this.timeline.valueAsNumber != -1){
            return this.actions[this.timeline.valueAsNumber];
        }
        else{
            return undefined;
        }
    }

    updateTimePos(pos: number){
        if(this.prevTimePos < pos){
            for(let i = this.prevTimePos + 1; i <= pos; i++){
                this.actions[i].enable();
            }
        }
        else if(pos < this.prevTimePos){
            for(let i = Math.min(this.prevTimePos, this.actions.length - 1); pos < i; i--){
                this.actions[i].disable();
            }
        }
    
        this.board.scrollTop = this.board.scrollHeight;
        window.scrollTo(0,document.body.scrollHeight);
    
        if(this.timeline.valueAsNumber != pos){
    
            this.timeline.valueAsNumber = pos;
        }
    
        this.prevTimePos = pos;
    
        let act = this.currentWidget();
        if(act instanceof SpeechWidget){
            
            let [caption, speech] = act.getCaptionSpeech();
            this.caption.textContent = caption;
            reprocessMathJax(act, this.caption, caption);
        }
        else{

            this.caption.textContent = "";
        }
    }    
    
    playWidgets(oncomplete:()=>void){
        function* fnc(ui: UI){
            let startPos = Math.max(0, ui.timeline.valueAsNumber);
    
            for(let pos = startPos; pos < ui.actions.length; pos++){
                let act = ui.actions[pos];
                yield* act.play();
                ui.updateTimePos(pos);
    
                if(ui.pauseFlag){
                    break;
                }
            }
    
            if(ui.pauseFlag){
    
                ui.pauseFlag = false;
            }
            else{
    
                if(oncomplete != undefined){
    
                    oncomplete();
                }
            }
        }
        
        runGenerator( fnc(this) );
    }
}


export class Widget{
    ui: UI;
    typeName: string;
    id: number;

    constructor(ui: UI){
        this.ui = ui;
        this.typeName = this.getTypeName();
        if(this.ui.actions.length == 0){
            this.id = 0;
        }
        else{
            this.id = Math.max(... this.ui.actions.map(x => x.id)) + 1;
        }
    }

    getTypeName(){
        return this.constructor.name;
    }

    toStr() : string {
        console.assert(false);
        return "";
    }

    enable(){
    }

    disable(){
    }

    *play() : any {
        this.enable();
        yield;
    }

    summary() : string {
        return this.getTypeName();
    }
}

export class EmptyWidget extends Widget {
    summary() : string {
        return "空";
    }
}

export class SelectionWidget extends Widget {
    refId: number;
    textAct: TextBlockWidget;
    domType: string;
    startIdx: number = -1;
    endIdx: number = -1;
    color: number;
    border: HTMLDivElement | null = null;

    constructor(ui: UI, refId: number, domType: string, startIdx: number, endIdx: number, color: number){
        super(ui);
        this.refId   = refId;        

        this.textAct  = ui.getWidgetById(refId) as TextBlockWidget;
        this.domType  = domType;
        this.startIdx = startIdx;
        this.endIdx   = endIdx;
        this.color    = color;
    }

    toStr() : string {
        return `{ "type": "select", "refId": ${this.refId}, "domType": "${this.domType}", "startIdx": ${this.startIdx}, "endIdx": ${this.endIdx}, "color": ${this.color} }`;
    }

    moveBorder(){
        let selectedDoms = this.setSelectedDoms();
        let rc0 = this.textAct.div.getBoundingClientRect();

        let minX = Number.MAX_VALUE, minY = Number.MAX_VALUE;
        let maxX = 0, maxY = 0;

        for(let dom of selectedDoms){
            let rc = dom.getBoundingClientRect();
            minX = Math.min(minX, rc.left);
            minY = Math.min(minY, rc.top);
            maxX = Math.max(maxX, rc.right);
            maxY = Math.max(maxY, rc.bottom);    
        }

        let bw = 2;

        this.border!.style.left   = `${minX - bw - rc0.left}px`;
        this.border!.style.top    = `${minY - bw - rc0.top}px`;
        this.border!.style.width  = `${maxX - minX + 2*bw}px`;
        this.border!.style.height = `${maxY - minY + 2*bw}px`;
        this.border!.style.borderWidth = `${bw}px`;
    }
    
    enable(){
        if(this.border == null){
            this.border = document.createElement("div");
            this.border.style.position = "absolute";
            this.border.style.zIndex = "-1";
            this.border.style.margin = "0px";
            this.border.style.backgroundColor = "transparent";
            this.border.style.borderStyle = "solid";
            this.textAct.div.appendChild(this.border);
        }
        this.moveBorder();
        this.border.style.borderColor = colors[this.color];
        this.border.style.display = "inline-block";
    }

    disable(){
        let selectedDoms = this.setSelectedDoms();
        for(let dom of selectedDoms){
            dom.style.color = "unset";
            dom.style.backgroundColor = "unset";
        }    

        this.border!.style.display = "none";
    }

    summary() : string {
        return "選択";
    }

    setSelectedDoms() : HTMLElement[]{
        console.assert(this.domType == "math");

        let v = Array.from(this.textAct.div.querySelectorAll('MJX-MI, MJX-MN, MJX-MO')) as HTMLElement[];

        return v.slice(this.startIdx, this.endIdx);
    }
}

export class TextWidget extends Widget {
    text: string;

    constructor(ui: UI, text: string){
        super(ui);
        this.text = text;
    }
}

export class SpeechWidget extends TextWidget {

    constructor(ui: UI, text: string){
        super(ui, text);
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

export class TextBlockWidget extends TextWidget {
    div: HTMLDivElement;
    lineFeed: boolean = false;
    initialize = false;

    constructor(ui: UI, text: string){
        super(ui, text);

        let nextEle = null;

        if(this.ui.timeline.valueAsNumber != -1){

            for(let act of this.ui.actions.slice(this.ui.timeline.valueAsNumber + 1)){
                if(act instanceof TextBlockWidget){
                    nextEle = act.div;
                    break;
                }
            }
        }
        
        this.div = document.createElement("div");
    
        this.div.id = getBlockId(this.id);
        this.div.style.position = "relative";
        this.div.style.display = "none";
    
        this.ui.board.insertBefore(this.div, nextEle);
    
        this.div.tabIndex = 0;
        
        ui.setTextBlockEventListener(this);
    }

    enable(){
        this.div.style.display = "inline-block";
        if(! this.initialize){
            this.initialize = true;

            const html = makeHtmlLines(this.text);
            this.div.innerHTML = html;
            reprocessMathJax(this, this.div, html);
        }
    }

    disable(){
        this.div.style.display = "none";
    }

    toStr() : string {
        return `{ "type": "text", "text":${tostr(this.text)} }`;
    }

    summary() : string {
        return "文字";
    }

    updateLineFeed(){
        if(this.div.nextSibling != null && this.div.nextSibling.nodeName == "BR"){
            // 次がBRの場合

            if(!this.lineFeed){
                // 改行しない場合

                this.div.parentNode!.removeChild(this.div.nextSibling);
            }
        }
        else{
            // 次がBRでない場合

            if(this.lineFeed){
                // 改行する場合

                let  br = document.createElement("br");
                br.className = "line-feed"
                this.div.parentNode!.insertBefore(br, this.div.nextSibling);
            }    
        }
    }
}

export function getBlockId(refId: number) : string {
    return `${idPrefix}${refId}`;
}


export function pauseWidget(ui: UI, fnc:()=>void){
    ui.pauseFlag = true;
    cancelSpeech();

    const id = setInterval(function(){
        if(! ui.pauseFlag && ! isSpeaking){

            clearInterval(id);
            msg("停止しました。");
            fnc();
        }
    },10);
}



// }


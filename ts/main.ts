namespace tekesan {
declare let MathJax:any;

export const idPrefix = "tekesan-id-";

export let colors : string[] = [ "magenta", "blue", "limegreen" ];

export class UI {
    actions : Action[] = [];
    prevTimePos : number;
    pauseFlag : boolean;
    suppressMathJax: boolean;

    btnPlayPause: HTMLButtonElement;
    board : HTMLDivElement;
    timeline : HTMLInputElement;
    caption: HTMLSpanElement;

    isPlaying = false;

    constructor(div: HTMLDivElement){
        this.prevTimePos = -1;
        this.pauseFlag = false;
        this.suppressMathJax = false;

        this.btnPlayPause = document.createElement("button");
        this.btnPlayPause.disabled = true;
        this.btnPlayPause.style.fontFamily = "Segoe UI Emoji";
        this.btnPlayPause.style.fontSize = "40px";
        this.btnPlayPause.innerHTML = "⏹";
        this.btnPlayPause.onclick = this.clickPlayPause.bind(this);
        div.appendChild(this.btnPlayPause);

        this.timeline = document.createElement("input");
        this.timeline.type = "range";
        this.timeline.min ="-1";
        this.timeline.max = "-1";
        this.timeline.value = "-1";
        this.timeline.step = "1";
        this.timeline.style.width = "100%";
        this.timeline.onchange = this.rngTimelineChange.bind(this);
        div.appendChild(this.timeline);

        this.board    = document.createElement("div");
        this.board.style.overflow = "scroll";
        this.board.style.borderStyle = "inset";
        this.board.style.borderWidth = "3px";
        div.appendChild(this.board);

        this.caption  = document.createElement("h3");
        this.caption.style.textAlign = "center";
        div.appendChild(this.caption);

        let path = div.getAttribute("data-path");
        if(path != null){

            this.openDoc(path);
        }
    }
        
    onOpenDocComplete = ()=>{
        this.btnPlayPause.disabled = false;
        this.btnPlayPause.innerHTML = "▶️";
    }  

    clickPlayPause(){
        if(this.isPlaying){
    
            this.btnPlayPause.disabled = true;
            tekesan.pauseAction(this, ()=>{
                this.btnPlayPause.disabled = false;
                this.btnPlayPause.innerHTML = "▶️";
            });
        }
        else{
    
            this.btnPlayPause.innerHTML = "⏸";
            this.playActions(()=>{
    
                this.btnPlayPause.innerHTML = "▶️";
                this.isPlaying = false;
            });
        }
        this.isPlaying = ! this.isPlaying;
        // document.getElementById("btn-play").style.display="none";
    }

    rngTimelineChange(){
        msg(`changed`);
        while(this.actions.some(x => x instanceof EmptyAction)){
            let idx = this.actions.findIndex(x => x instanceof EmptyAction);
            this.actions.splice(idx, 1);
        }
    
        this.prevTimePos = Math.min(this.prevTimePos, this.actions.length - 1);
        this.timeline.max = `${this.actions.length - 1}`;
        this.updateTimePos(this.timeline.valueAsNumber);
    }    

    currentAction() : Action | undefined {
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
    
        let act = this.currentAction();
        if(act instanceof SpeechAction){
            
            let [caption, speech] = act.getCaptionSpeech();
            this.caption.textContent = caption;
            reprocessMathJax(this, caption);
        }
        else{

            this.caption.textContent = "";
        }

        if(UIEdit != undefined && this instanceof UIEdit){
    
            this.updateSummaryTextArea();
        }
    }    
    
    playActions(oncomplete:()=>void){
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
    
    openDoc(path: string){
        fetchText(`json/${path}.json`, (text: string)=>{
            this.deserializeDoc(text);
        });
    }
    
    deserializeDoc(text: string){
        this.actions = [];
    
        this.board.innerHTML = "";
    
        const doc = JSON.parse(reviseJson(text));

        if(UIEdit != undefined && this instanceof UIEdit){
            this.txtTitle.value = doc.title;
        }
    
        const h1 = document.createElement("h1");
        h1.innerHTML = doc.title;
        this.board.appendChild(h1);
    
        this.suppressMathJax = true;
        for(let [id, obj] of doc.actions.entries()){
            let act: Action;
    
            switch(obj.type){
            case "text":
                act = new TextBlockAction(this, (obj as TextBlockAction).text);
                break;
            
            case "speech":
                act = new SpeechAction(this, (obj as SpeechAction).text);
                break;
    
            case "select":
                let sel = obj as SelectionAction;
                act = new SelectionAction(this, sel.refId, sel.domType, sel.startPath, sel.endPath, sel.color);
                break;
    
            case "disable":
                act = new DisableAction(this, (obj as DisableAction).refId);
                break;
    
            default:
                console.assert(false);
                return;
            }
            console.assert(act.id == id);
    
            this.actions.push(act);
    
            this.timeline.max = `${this.actions.length - 1}`;
            this.timeline.valueAsNumber = this.actions.length - 1;
        }
        this.suppressMathJax = false;
    
        if(UIEdit != undefined && this instanceof UIEdit){
    
            this.summary.textContent = last(this.actions).summary();
        }
    
        MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
        MathJax.Hub.Queue([()=>{
            this.timeline.max = `${this.actions.length - 1}`;
            this.updateTimePos(this.actions.length - 1);
            this.updateTimePos(-1);
    
            this.onOpenDocComplete();
        }]);
    }

}


export class Action{
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

    *play(){
        this.enable();
        yield;
    }

    summary() : string {
        return this.getTypeName();
    }
}

export class RefAction extends Action {
    refId: number;

    constructor(ui: UI, refId: number){
        super(ui);
        this.refId   = refId;        
    }
}    


export class EmptyAction extends Action {
    summary() : string {
        return "空";
    }
}

export class SelectionAction extends RefAction {
    domType: string;
    startPath: [number, string][] | null;
    endPath: [number, string][] | null;
    color: number;
    border: HTMLDivElement | null = null;

    constructor(ui: UI, refId: number, domType: string, startPath: [number, string][] | null, endPath: [number, string][] | null, color: number){
        super(ui, refId);

        this.domType   = domType;
        this.startPath = startPath;
        this.endPath   = endPath;
        this.color     = color;
    }

    toStr() : string {
        const start = this.getJaxPathStr(this.startPath);
        const end   = this.getJaxPathStr(this.endPath);

        return `{ "type": "select", "refId": ${this.refId}, "domType": "${this.domType}", "startPath": ${start}, "endPath": ${end}, "color": ${this.color} }`;
    }

    getJaxPathStr(path : [number, string][] | null){
        if(path == null){
            return "null";
        }
        else{

            return "[" + path.map(x => `[${x[0]}, "${x[1]}"]`).join(", ") + "]";
        }
    }
    
    enable(){
        let selectedDoms = this.setSelectedDoms();

        let minX = Number.MAX_VALUE, minY = Number.MAX_VALUE;
        let maxX = 0, maxY = 0;

        if(this.border == null){
            const div = document.getElementById(getBlockId(this.refId)) as HTMLDivElement;
            let rc0 = div.getBoundingClientRect();

            for(let dom of selectedDoms){
                let rc = dom.getBoundingClientRect();
                minX = Math.min(minX, rc.left);
                minY = Math.min(minY, rc.top);
                maxX = Math.max(maxX, rc.right);
                maxY = Math.max(maxY, rc.bottom);    
            }

            let bw = 2;
            this.border = document.createElement("div");
            this.border.style.position = "absolute";
            this.border.style.zIndex = "-1";
            this.border.style.margin = "0px";
            this.border.style.left   = `${minX - bw - rc0.left}px`;
            this.border.style.top    = `${minY - bw - rc0.top}px`;
            this.border.style.width  = `${maxX - minX + 2*bw}px`;
            this.border.style.height = `${maxY - minY + 2*bw}px`;
            this.border.style.backgroundColor = "transparent";
            this.border.style.borderStyle = "solid";
            this.border.style.borderWidth = `${bw}px`;
            div.appendChild(this.border);
        }
        this.border.style.borderColor = colors[this.color];
        this.border.style.display = "block";
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

        let selectedDoms: HTMLElement[] = [];
    
        const div = document.getElementById(getBlockId(this.refId)) as HTMLDivElement;
        const jaxes = getJaxesInBlock(div);
    
        const startJax = getJaxFromPath(jaxes, this.startPath);
        const startIdx = last(this.startPath!)[IDX];
    
        const parentJax = startJax.parent;
        console.assert(getJaxIndex(startJax) == startIdx);
        console.assert(startJax.nodeName == last(this.startPath!)[NODE_NAME])
    
        if(this.endPath == null){
    
            selectedDoms.push(getDomFromJax(startJax));
        }
        else{
    
            const endJax = getJaxFromPath(jaxes, this.endPath);
    
            const endIdx = last(this.endPath)[IDX];
    
            console.assert(getJaxIndex(endJax) == endIdx);
            console.assert(endJax.nodeName == last(this.endPath)[NODE_NAME])
        
            const nodes = parentJax!.childNodes!.slice(startIdx, endIdx + 1);
            for(let nd of nodes){
    
                if(nd != null){
    
                    selectedDoms.push(getDomFromJax(nd));
                }
            }    
        }

        return selectedDoms;
    }
}

export class DisableAction extends RefAction {
    disableAct: Action;

    constructor(ui: UI, refId: number){
        super(ui, refId);
        this.refId = refId;
        this.disableAct = this.ui.actions.find(x => x.id == refId)!;
        console.assert(this.disableAct != undefined);
    }

    toStr() : string {
        return `{ "type": "disable", "refId": ${this.refId} }`;
    }

    enable(){
        this.disableAct.disable();
    }

    disable(){
        this.disableAct.enable();
    }

    summary() : string {
        return "無効";
    }
}


export class TextAction extends Action {
    text: string;

    constructor(ui: UI, text: string){
        super(ui);
        this.text = text;
    }
}

export class SpeechAction extends TextAction {

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

export class TextBlockAction extends TextAction {
    div: HTMLDivElement;

    constructor(ui: UI, text: string){
        super(ui, text);

        this.div = this.makeTextDiv(this.text);

        if(UIEdit != undefined && this.ui instanceof UIEdit ){

            this.div.addEventListener("click", (ev:MouseEvent)=>{
                onClickBlock(this, ev);
            });
        
            this.div.addEventListener('keydown', (event) => {
                msg(`key down ${event.key} ${event.ctrlKey}`);
            }, false);
        }
    }

    enable(){
        this.div.style.display = "block";
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

    makeTextDiv(text: string) : HTMLDivElement {
        let nextEle = null;

        if(this.ui.timeline.valueAsNumber != -1){

            for(let act of this.ui.actions.slice(this.ui.timeline.valueAsNumber + 1)){
                if(act instanceof TextBlockAction){
                    nextEle = act.div;
                    break;
                }
            }
        }
        const div = document.createElement("div");
    
        div.id = getBlockId(this.id);
        div.style.position = "relative";
    
        this.ui.board.insertBefore(div, nextEle);
    
        div.tabIndex = 0;
    
        const html = makeHtmlLines(text);
        div.innerHTML = html;
        reprocessMathJax(this.ui, html);

        if(UIEdit != undefined && this.ui instanceof UIEdit){

            div.addEventListener("keydown", (ev: KeyboardEvent)=>{
                if(ev.key == "Delete" && ! ev.ctrlKey && ! ev.shiftKey){
                    ev.stopPropagation();
                    ev.preventDefault();

                    let ele = ev.srcElement as HTMLElement;
                    msg(`del ${ele.tagName} ${ele.id}`);
                    const hideAct = new DisableAction(this.ui, this.id);
                    (this.ui as UIEdit).addAction(hideAct);
                }
            })
        }
    
        return div;
    }
}

export function getBlockId(refId: number) : string {
    return `${idPrefix}${refId}`;
}




export function pauseAction(ui: UI, fnc:()=>void){
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

export function initPlayer(){
    initSpeech();

    msg("body loaded");
   
    let divs = Array.from(document.getElementsByClassName("tekesan")) as HTMLDivElement[];

    if(window.location.search != ""){
        console.assert(window.location.search[0] == '?');

        for(let item of window.location.search.substring(1).split('&')){
            let [key, value] = item.split("=");
            if(key == "path"){
                let div = divs[0];

                let ui = new UI(div);
                ui.openDoc(value);
            }
        }
    }
    else{

        for(let div of divs){

            let ui = new UI(div);
        }
    }
}

export function initEdit(div: HTMLDivElement, txtTitle: HTMLInputElement, selColors: HTMLInputElement[], summary : HTMLSpanElement, textArea : HTMLTextAreaElement) : UIEdit {
    if(window.location.search.includes("debug=1")){

        // <textarea id="txt-msg" rows="15" style="display: none; width: 100%; overflow-x: visible; white-space: pre; font-size: large; font-weight: bold; " spellcheck="false" ></textarea>
        textMsg      = document.getElementById("txt-msg") as HTMLDivElement;
        textMsg.style.display = "block";
    }

    initSpeech();

    msg("body loaded");

    return new UIEdit(div, txtTitle, selColors, summary, textArea);
}

}


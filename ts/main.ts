namespace tekesan {

export const idPrefix = "tekesan-id-";

export let colors : string[];

let prevTimePos : number;
let pauseFlag : boolean;

export let actions : Action[];
export let suppressMathJax: boolean;
export let ui: UI;

class UI {
    board : HTMLDivElement;
    timeline : HTMLInputElement;
    summary : HTMLSpanElement;
    textArea : HTMLTextAreaElement;
    caption: HTMLSpanElement;
    selColors: HTMLInputElement[];
    msg : HTMLDivElement;
    edit : true;
}

export class Action{
    typeName: string;
    id: number;

    constructor(){
        this.typeName = this.getTypeName();
        if(actions.length == 0){
            this.id = 0;
        }
        else{
            this.id = Math.max(... actions.map(x => x.id)) + 1;
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
    selectedDoms : HTMLElement[];
    color: number;
    border: HTMLDivElement | null = null;

    constructor(refId: number, domType: string, startPath: [number, string][] | null, endPath: [number, string][] | null, color: number){
        super();

        this.refId   = refId;
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
        this.setSelectedDoms();

        let minX = Number.MAX_VALUE, minY = Number.MAX_VALUE;
        let maxX = 0, maxY = 0;

        if(this.border == null){
            const div = document.getElementById(getBlockId(this.refId)) as HTMLDivElement;
            let rc0 = div.getBoundingClientRect();

            for(let dom of this.selectedDoms){
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
        this.setSelectedDoms();
        for(let dom of this.selectedDoms){
            dom.style.color = "unset";
            dom.style.backgroundColor = "unset";
        }    

        this.border.style.display = "none";
    }

    summary() : string {
        return "選択";
    }

    setSelectedDoms(){
        console.assert(this.domType == "math");

        this.selectedDoms = [];
    
        const div = document.getElementById(getBlockId(this.refId)) as HTMLDivElement;
        const jaxes = getJaxesInBlock(div);
    
        const startJax = getJaxFromPath(jaxes, this.startPath);
        const startIdx = last(this.startPath)[IDX];
    
        const parentJax = startJax.parent;
        console.assert(getJaxIndex(startJax) == startIdx);
        console.assert(startJax.nodeName == last(this.startPath)[NODE_NAME])
    
        if(this.endPath == null){
    
            this.selectedDoms.push(getDomFromJax(startJax));
        }
        else{
    
            const endJax = getJaxFromPath(jaxes, this.endPath);
    
            const endIdx = last(this.endPath)[IDX];
    
            console.assert(getJaxIndex(endJax) == endIdx);
            console.assert(endJax.nodeName == last(this.endPath)[NODE_NAME])
        
            const nodes = parentJax.childNodes.slice(startIdx, endIdx + 1);
            for(let nd of nodes){
    
                if(nd != null){
    
                    this.selectedDoms.push(getDomFromJax(nd));
                }
            }    
        }
    }
}

export class DisableAction extends RefAction {
    disableAct: Action;

    constructor(refId: number){
        super();
        this.refId = refId;
        this.disableAct = actions.find(x => x.id == refId);
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
}

export class SpeechAction extends TextAction {

    constructor(text: string){
        super();
        this.text = text;
    }

    toStr() : string {
        return `{ "type": "speech", "text":${tostr(this.text)} }`;
    }

    *play(){
        this.enable();
        yield* speak(this.text);
    }

    summary() : string {
        return "音声";
    }
}

export class TextBlockAction extends TextAction {
    div: HTMLDivElement;

    constructor(text: string){
        super();

        this.text = text;    
        this.div = this.makeTextDiv(this.text);

        if(ui.edit){

            this.div.addEventListener("click", function(ev:MouseEvent){
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

        if(ui.timeline.valueAsNumber != -1){

            for(let act of actions.slice(ui.timeline.valueAsNumber + 1)){
                if(act instanceof TextBlockAction){
                    nextEle = act.div;
                    break;
                }
            }
        }
        const div = document.createElement("div");
    
        div.id = getBlockId(this.id);
        div.style.position = "relative";
    
        ui.board.insertBefore(div, nextEle);
    
        div.tabIndex = 0;
    
        const html = makeHtmlLines(text);
        div.innerHTML = html;
        reprocessMathJax(html);

        div.addEventListener("keydown", (ev: KeyboardEvent)=>{
            if(ev.key == "Delete" && ! ev.ctrlKey && ! ev.shiftKey){
                ev.stopPropagation();
                ev.preventDefault();

                let ele = ev.srcElement as HTMLElement;
                msg(`del ${ele.tagName} ${ele.id}`);
                const hideAct = new DisableAction(this.id);
                addAction(hideAct);
            }
        })
    
        return div;
    }
}

export function getBlockId(refId: number) : string {
    return `${idPrefix}${refId}`;
}

export function updateTimePos(pos: number){
    if(prevTimePos < pos){
        for(let i = prevTimePos + 1; i <= pos; i++){
            actions[i].enable();
        }
    }
    else if(pos < prevTimePos){
        for(let i = Math.min(prevTimePos, actions.length - 1); pos < i; i--){
            actions[i].disable();
        }
    }

    ui.board.scrollTop = ui.board.scrollHeight;
    window.scrollTo(0,document.body.scrollHeight);

    if(ui.timeline.valueAsNumber != pos){

        ui.timeline.valueAsNumber = pos;
    }

    prevTimePos = pos;

    if(ui.edit){

        updateSummaryTextArea();
    }
}

export function addAction(act: Action){
    let selIdx = ui.timeline.valueAsNumber + 1;

    actions.splice(selIdx, 0, act);

    ui.timeline.max = `${actions.length - 1}`;
    updateTimePos(selIdx);

    ui.textArea.focus();
}


function rngTimelineChange(ev: Event){
    msg(`changed`);
    while(actions.some(x => x instanceof EmptyAction)){
        let idx = actions.findIndex(x => x instanceof EmptyAction);
        actions.splice(idx, 1);
    }

    prevTimePos = Math.min(prevTimePos, actions.length - 1);
    ui.timeline.max = `${actions.length - 1}`;
    updateTimePos(ui.timeline.valueAsNumber);
}

export function playActions(oncomplete:()=>void){
    function* fnc(){
        let startPos = Math.max(0, ui.timeline.valueAsNumber);

        for(let pos = startPos; pos < actions.length; pos++){
            let act = actions[pos];
            yield* act.play();
            updateTimePos(pos);

            if(pauseFlag){
                break;
            }
        }

        if(pauseFlag){

            pauseFlag = false;
        }
        else{

            if(oncomplete != undefined){

                oncomplete();
            }
        }
    }
    
    runGenerator( fnc() );
}

export function pauseAction(fnc:()=>void){
    pauseFlag = true;
    cancelSpeech();

    const id = setInterval(function(){
        if(! pauseFlag && ! isSpeaking){

            clearInterval(id);
            msg("停止しました。");
            fnc();
        }
    },10);
}


export function initTekesan(ui1: UI, oncomplete:()=>void){
    pauseFlag = false;
    colors = [ "magenta", "blue", "limegreen" ];

    ui = ui1;
    console.assert(ui.board != undefined && ui.timeline != undefined);

    msg("body loaded");

    suppressMathJax = false;

    initSpeech();

    prevTimePos = -1;
    ui.timeline.addEventListener("change", rngTimelineChange);

    if(ui.edit == true){
        initEdit();
    }

    if(window.location.search != ""){
        console.assert(window.location.search[0] == '?');
        
        for(let item of window.location.search.substring(1).split('&')){
            let [key, value] = item.split("=");
            if(key == "path"){
                openDoc(value, oncomplete);
            }
        }
    }
}


}
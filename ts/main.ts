namespace tekesan {

declare let MathJax:any;

const IDX = 0;
const NODE_NAME = 1;
const idPrefix = "tekesan-id-";

let colors : string[];

let prevTimePos : number;
let pauseFlag : boolean;

export let actions : Action[];
export let ActionId;
export let suppressMathJax: boolean;

let speechInput : boolean;
let prevTextValue: string = "";

let selectColor : number;
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

class JaxNode {
    CHTMLnodeID: number;
    nodeName: string;
    parent: JaxNode;
    childNodes: JaxNode[];
}

class ElementJax {
    root : JaxNode;
    Rerender(){}
}

export class Action{
    typeName: string;
    id: number;

    constructor(){
        this.typeName = this.getTypeName();
        this.id = ActionId;
        ActionId++;
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


class TextAction extends Action {
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

function setTextMathValue(text: string){
    ui.textArea.value = text;
    prevTextValue = text;
}

export function getBlockId(refId: number) : string {
    return `${idPrefix}${refId}`;
}

export function getActionId(id: string) : number {
    console.assert(id.startsWith(idPrefix));
    return parseInt(id.substring(idPrefix.length));
}


function getJaxesInBlock(div: HTMLDivElement) : JaxNode[]{
    const allJaxes = (MathJax.Hub.getAllJax() as ElementJax[]).map(x => x.root);

    const allDoms = allJaxes.map(x => getDomFromJax(x));

    const domsInSpan = allDoms.filter(x => getDomAncestors(x).includes(div) );

    const jaxesInSpan = domsInSpan.map(x => allJaxes[allDoms.indexOf(x)]);

    return jaxesInSpan;
}

function getJaxFromPath(jaxes:JaxNode[], path:any[]) : JaxNode {
    let node = jaxes[path[0][IDX]];
    console.assert(node.nodeName == path[0][NODE_NAME])

    for(let obj of path.slice(1)){
        node = node.childNodes[obj[IDX]];
        console.assert(node.nodeName == obj[NODE_NAME])
    }

    return node;
}


function getJaxIndex(node){
    return node.parent.childNodes.indexOf(node);
}

function getDomFromJax(node: JaxNode) : HTMLElement{
    return document.getElementById(`MJXc-Node-${node.CHTMLnodeID}`);
}

function getDomAncestors(node: Node) : HTMLElement[] {
    function* fnc(node: Node){
        for(let nd = node.parentElement; nd != null; nd = nd.parentElement){
            yield nd;
        }
    }

    return Array.from(fnc(node));
}


function reprocessMathJax(html: string){

    if(!suppressMathJax && html.includes("$")){
        MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
    }
}

function getJaxPath(jaxIdx: number, jaxList:JaxNode[], maxNest: number) : any[]{
    const path : [number, string][] = [];

    let parent = jaxList[0];

    path.push([jaxIdx, parent.nodeName]);

    for(let nest = 1; nest <= maxNest; nest++){
        let jax = jaxList[nest];
        let idx = parent.childNodes.indexOf(jax);
        console.assert(idx != -1);
        path.push([ idx, jax.nodeName]);
        parent = jax;
    }

    return path;
}

function* getJaxDescendants(node:JaxNode){
    if(node != null && node.nodeName != undefined && node.CHTMLnodeID != undefined){

        yield node;

        if(! ["mi", "mn", "mo"].includes(node.nodeName)){

            if(node.childNodes != undefined){
                for(let nd of node.childNodes){
                    yield* getJaxDescendants(nd);
                }
            }
        }
    }
}


function makeDomJaxMap(jaxes: JaxNode[]) : [Map<HTMLElement, JaxNode>, Map<JaxNode, HTMLElement>]{
    const dom2jax = new Map<HTMLElement, JaxNode>();
    const jax2dom = new Map<JaxNode, HTMLElement>();
    for(let ej of jaxes){
        for(let node of getJaxDescendants(ej)){

            let ele = getDomFromJax(node);
            dom2jax.set(ele, node);
            jax2dom.set(node, ele);
        }
    }

    return [dom2jax, jax2dom];
}

export function findSelectedDoms(div: HTMLDivElement, ev:MouseEvent) : boolean{
    const selActs = actions.filter(x => x instanceof SelectionAction) as SelectionAction[];

    for(let ele = ev.srcElement as HTMLElement; ; ele = ele.parentElement){
        if(ele == ui.board || !(ele instanceof HTMLElement)){

            return false;
        }

        let sels = selActs.filter(x => x.selectedDoms.includes(ele) );
        if(sels.length != 0){
            msg("選択無効");
            
            const hideAct = new DisableAction(sels[0].id);
            addAction(hideAct);
            return true;
        }
    }
}

export function onClickBlock(div: HTMLDivElement, ev:MouseEvent){
    msg("clicked");

    ev.stopPropagation();

    const found = findSelectedDoms(div, ev);
    if(found){
        return;
    }

    let mjxMath = null;
    for(let ele = ev.srcElement as HTMLElement;; ele = ele.parentNode as HTMLElement){

        if(ele.tagName != "SPAN"){
            break;
        }
        if(ele.className == "mjx-math"){
            mjxMath = ele;
            break;
        }
    }
    if(mjxMath == null){
        return;
    }

    const jaxes = getJaxesInBlock(div);
    const [dom2jax, jax2dom] = makeDomJaxMap(jaxes);

    function checkPath(text: string, path:any[], node2: JaxNode){
        msg(`${text}: ${path.map(x => `${x[IDX]}:${x[NODE_NAME]}`).join(',')}`);
        const node = getJaxFromPath(jaxes, path);
        console.assert(node == node2);
    }

    const sel = window.getSelection();
    
    if(sel.rangeCount == 1){

        let selAct : SelectionAction | null = null;

        const rng = sel.getRangeAt(0);

        msg(`start:${rng.startContainer.textContent} end:${rng.endContainer.textContent}`);

        const stAncs = getDomAncestors(rng.startContainer).filter(x => dom2jax.has(x)).map(x => dom2jax.get(x)).reverse();
        let jaxIdx;
        for(jaxIdx = 0; jaxIdx < jaxes.length; jaxIdx++){
            if(jaxes[jaxIdx] == stAncs[0]){
                break;
            }
        }

        msg(`all jax: ${jaxIdx}`);

        if(rng.startContainer == rng.endContainer){

            if(stAncs.length != 0){

                const startPath = getJaxPath(jaxIdx, stAncs, stAncs.length - 1);
                checkPath("path", startPath, last(stAncs));

                selAct = new SelectionAction(getActionId(div.id), "math", startPath, null, selectColor);
            }
        }
        else{

            const edAncs = getDomAncestors(rng.endContainer).filter(x => dom2jax.has(x)).map(x => dom2jax.get(x)).reverse();

            for(let nest = 0; nest < Math.min(stAncs.length, edAncs.length); nest++){
                if(stAncs[nest] != edAncs[nest]){

                    console.assert(nest != 0);

                    let parentJax = stAncs[nest - 1];

                    if(parentJax.nodeName == "msubsup"){

                        let startPath = getJaxPath(jaxIdx, stAncs, nest - 1);
                        checkPath("path", startPath, parentJax);

                        selAct = new SelectionAction(getActionId(div.id), "math", startPath, null, selectColor);
                    }
                    else{

                        let startPath = getJaxPath(jaxIdx, stAncs, nest);
                        let endPath   = getJaxPath(jaxIdx, edAncs, nest);

                        checkPath("path1", startPath, stAncs[nest]);
                        checkPath("path2", endPath  , edAncs[nest]);

                        selAct = new SelectionAction(getActionId(div.id), "math", startPath, endPath, selectColor);
                    }
                    break;
                }
            }
        }

        if(selAct != null){
            selAct.enable();

            addAction(selAct);
        }
    }

    window.getSelection().removeAllRanges();
}

export function newDocument(){
    ActionId = 0;
    actions = [];

    ui.board.innerHTML = "";
    if(ui.edit){

        setTextMathValue("");
    }
}

function updateFocusedTextBlock(){
    const text = ui.textArea.value.trim();
    const act = currentAction();

    if(act instanceof TextBlockAction){

        const html = makeHtmlLines(text);
        act.div.innerHTML = html;
        act.text = text;

        reprocessMathJax(html);
    }
    else if(act instanceof SpeechAction){

        act.text = text;
    }

    ui.summary.textContent = act.summary();
}

function updateTextMath(){
    if(prevTextValue != ui.textArea.value && prevTextValue != ui.textArea.value.trim()){

        let trimValue = ui.textArea.value.trim();
        let selIdx = ui.timeline.valueAsNumber;
        const act = actions[selIdx];

        if(trimValue == ""){
            // テキストが削除された場合

            if(!(act instanceof EmptyAction)){
                // 空のアクションでない場合

                resetAction();
            }
        }
        else{
            // テキストが変更された場合

            if(prevTextValue == ""){
                // 新たにテキストを入力した場合

                if(act instanceof EmptyAction){
                    // 空のアクションの場合

                    if(speechInput){

                        const newAct = new SpeechAction(ui.textArea.value.trim());
                        setAction(newAct);    
                    }
                    else{

                        const newAct = new TextBlockAction(ui.textArea.value);
                        
                        setAction(newAct);                    
                    }
                }
                else{
                    // 空のアクションでない場合

                    updateFocusedTextBlock();
                }
            }
            else{

                updateFocusedTextBlock();
            }
        }

        prevTextValue = ui.textArea.value.trim();
    }
}

function monitorTextMath(){
    setInterval(updateTextMath, 500);

    ui.textArea.addEventListener("keydown", (ev: KeyboardEvent)=>{
        msg(`key down ${ev.key}`);
        if(ev.key == "Insert"){
            if(ev.ctrlKey){

                ui.textArea.value = "$$\n\\frac{1}{2 \\pi \\sigma^2} \\int_{-\\infty}^\\infty \\exp^{ - \\frac{{(x - \\mu)}^2}{2 \\sigma^2}  } dx\n$$";
            }
        }
    })

    ui.textArea.addEventListener("keypress", function(ev:KeyboardEvent){
        msg(`key press ${ev.ctrlKey} ${ev.key}`);
        if(ev.ctrlKey && ev.code == "Enter"){
            updateTextMath();

            let act = currentAction();
            if(act instanceof SpeechAction){
                runGenerator( act.play() );
            }

            addEmptyAction();

            ev.stopPropagation();
            ev.preventDefault();
        }
    });

    ui.textArea.addEventListener("blur", (ev: FocusEvent)=>{
        msg("blur");
        updateFocusedTextBlock();
    });
}

function currentAction() : Action | undefined {
    if(ui.timeline.valueAsNumber != -1){
        return actions[ui.timeline.valueAsNumber];
    }
    else{
        return undefined;
    }

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

export function updateSummaryTextArea(){
    if(ui.timeline.valueAsNumber == -1){

        setTextMathValue("");
        ui.summary.textContent = "";
    }
    else{

        const act = actions[ui.timeline.valueAsNumber];
        if(act instanceof TextAction){

            setTextMathValue(act.text);
        }
        else{
            setTextMathValue("");
        }

        ui.summary.textContent = act.summary();
    }
}

function setAction(act: Action){
    let selIdx = ui.timeline.valueAsNumber;

    console.assert(actions[selIdx] instanceof EmptyAction);
    actions[selIdx] = act;
    ui.summary.textContent = act.summary();
}

export function addAction(act: Action){
    let selIdx = ui.timeline.valueAsNumber + 1;

    actions.splice(selIdx, 0, act);

    ui.timeline.max = `${actions.length - 1}`;
    updateTimePos(selIdx);

    ui.textArea.focus();
}

export function addEmptyAction(){
    addAction(new EmptyAction());
}


export function deleteAction(){
    if(ui.timeline.valueAsNumber == -1){
        return;
    }

    function fnc(act: Action){

        const refActs = actions.filter(x => x instanceof RefAction && x.refId == act.id) as RefAction[];

        refActs.forEach(x => fnc(x));

        act.disable();
        if(act instanceof TextBlockAction){

            ui.board.removeChild(act.div);
        }
    
        let idx = actions.indexOf(act);
        console.assert(idx != -1);
        actions.splice(idx, 1);
    }

    fnc(actions[ui.timeline.valueAsNumber]);

    let selIdx = ui.timeline.valueAsNumber;
    ui.timeline.max = `${actions.length - 1}`;

    if(selIdx < actions.length){
        actions[selIdx].enable();
    }

    updateTimePos( Math.min(selIdx, actions.length - 1) );
}


function resetAction(){
    let selIdx = ui.timeline.valueAsNumber;

    const act = actions[selIdx] as TextBlockAction;
    if(act instanceof TextBlockAction){

        ui.board.removeChild(act.div);
    }

    actions[selIdx] = new EmptyAction();
    ui.summary.textContent = actions[selIdx].summary();
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

function initUI(){
    console.assert(ui.board != undefined && ui.timeline != undefined);

    if(ui.selColors == undefined){

        colors = [ "magenta", "blue", "limegreen" ];
    }
    else{

        colors = ui.selColors.map(x => x.value);

        function getSelectColor(){
            return colors.indexOf( ui.selColors.find(x => x.checked).value );
        }
        selectColor = getSelectColor();
        ui.selColors.forEach(inp =>{
            inp.addEventListener("click", (ev: MouseEvent)=>{
                selectColor = getSelectColor();

                let act = currentAction();
                if(act instanceof SelectionAction){
                    act.color = selectColor;
                    act.enable();
                }
            })
        });
    }

    if(ui.textArea != undefined){
        ui.textArea.style.backgroundColor = "white";

        document.body.addEventListener("keydown", (ev: KeyboardEvent)=>{
            if(ev.key == "Insert" && ! ev.ctrlKey && ! ev.shiftKey){
                speechInput = ! speechInput;
                if(speechInput){
                    ui.textArea.style.backgroundColor = "ivory";
                }
                else{

                    ui.textArea.style.backgroundColor = "white";
                }
            }
        });

        monitorTextMath();
    }
}

export function initTekesan(ui1: UI, oncomplete:()=>void){
    pauseFlag = false;
    ui = ui1;
    initUI();

    suppressMathJax = false;

    msg("body loaded");

    initSpeech();

    speechInput = false;
    newDocument();

    prevTimePos = -1;
    ui.timeline.addEventListener("change", rngTimelineChange);

    if(ui.edit == true){
        addEmptyAction();
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
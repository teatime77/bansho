namespace tekesan {

declare let MathJax:any;

const IDX = 0;
const NODE_NAME = 1;

export let divMath : HTMLDivElement;
let selActions : HTMLSelectElement;

export let actions : Action[];
export let ActionId;
export let inEditor : boolean;

let tmpSelection : SelectionAction | null;
export let selections : SelectionAction[];

let speechInput : boolean;
let prevTextValue: string = "";

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
    id: number;

    constructor(){
        this.id = ActionId;
        ActionId++;
    }

    init(){}

    *play(){
        yield;
    }


    *restore():any{}

    getTypeName(){
        return this.constructor.name;
    }

    toObj(){
        if(actionMap.has(this.id)){
            return { ref: this.id };
        }
        actionMap.set(this.id, this);
        
        const obj = { typeName: this.getTypeName(), id: this.id };

        this.makeObj(obj);

        return obj;
    }

    makeObj(obj){
    }

    clear(){}

    enable(){
    }

    disable(){
    }

    setEnable(enable: boolean){
        if(enable){
            this.enable();
        }
        else{
            this.disable();
        }
    }

    summary() : string {
        return this.getTypeName();
    }
}    


export class EmptyAction extends Action {
    summary() : string {
        return "空";
    }
}

export class SelectionAction extends Action {
    blockId: number;
    domType: string;
    startPath:any[];
    endPath:any[] | null;
    selectedDoms : HTMLElement[];
    isTmp: boolean = false;

    constructor(){
        super();
    }

    make(data:any):Action{
        const obj = data as SelectionAction;

        this.blockId   = obj.blockId;
        this.domType   = obj.domType;
        this.startPath = obj.startPath;
        this.endPath   = obj.endPath;

        return this;
    }

    makeObj(obj){
        Object.assign(obj, {
            blockId: this.blockId ,
            domType: this.domType ,
            startPath: this.startPath,
            endPath: this.endPath 
        });
    }

    init(){
        selections.push(this);
    }

    enable(){
        this.setSelectedDoms();
        for(let dom of this.selectedDoms){

            if(this.isTmp){

                // node.style.color = "#00CC00";
                dom.style.color = "#8080FF";
                // node.style.textDecoration = "wavy underline red"
                dom.style.backgroundColor = "#C0C0C0";
            }
            else{
    
                dom.style.color = "red";
            }
        }
    }

    disable(){
        this.setSelectedDoms();
        for(let dom of this.selectedDoms){
            dom.style.color = "unset";
            dom.style.backgroundColor = "unset";
        }    
    }

    summary() : string {
        return "選択";
    }

    setSelectedDoms(){
        console.assert(this.domType == "math");

        this.selectedDoms = [];
    
        const div = document.getElementById(getBlockId(this.blockId)) as HTMLDivElement;
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

export class SpeechAction extends Action {
    text: string;

    constructor(text: string){
        super();
        this.text = text;
    }

    makeObj(obj){
        Object.assign(obj, { text: this.text });
    }

    *play(){
        yield* speak(this.text);
    }

    summary() : string {
        return `音声 ${this.text}`;
    }
}

function setTextMathValue(text: string){
    textMath.value = text;
    prevTextValue = text;

}

export function getBlockId(blockId: number) : string {
    return `manebu-id-${blockId}`;
}


export function getActionId(id: string) : number {
    console.assert(id.startsWith("manebu-id-"));
    return parseInt(id.substring(10));
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

    if(html.includes("$")){
        MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
    }
}

function getJaxPath(jaxIdx: number, jaxList:JaxNode[], maxNest: number) : any[]{
    const path : any[] = [];

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

export function onclickBlock(div: HTMLDivElement, ev:MouseEvent){
    msg("clicked");

    if(tmpSelection != null){
        tmpSelection.disable();
        tmpSelection = null;
    }

    ev.stopPropagation();

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

                tmpSelection = new SelectionAction().make({blockId:getActionId(div.id), domType:"math", startPath:startPath, endPath:null}) as SelectionAction;
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

                        tmpSelection = new SelectionAction().make({blockId:getActionId(div.id), domType:"math", startPath:startPath, endPath:null}) as SelectionAction;
                    }
                    else{

                        let startPath = getJaxPath(jaxIdx, stAncs, nest);
                        let endPath   = getJaxPath(jaxIdx, edAncs, nest);

                        checkPath("path1", startPath, stAncs[nest]);
                        checkPath("path2", endPath  , edAncs[nest]);

                        tmpSelection = new SelectionAction().make({blockId:getActionId(div.id), domType:"math", startPath:startPath, endPath:endPath}) as SelectionAction;
                    }
                    break;
                }
            }
        }

        if(tmpSelection != null){
            tmpSelection.isTmp = true;
            tmpSelection.setSelectedDoms();
            tmpSelection.enable();


            addSelection();
        }
    }

    window.getSelection().removeAllRanges();
}


class DivAction extends Action {
    text: string;
    div: HTMLDivElement;

    enable(){
        this.div.style.display = "block";
    }

    disable(){
        this.div.style.display = "none";
    }

    makeTextDiv(text: string) : HTMLDivElement {
        let nextEle = null;
        if(selActions.selectedIndex != -1){

            for(let act of actions.slice(selActions.selectedIndex + 1)){
                if(act instanceof DivAction){
                    nextEle = act.div;
                    break;
                }
            }
        }
        const div = document.createElement("div");
        div.className = "manebu-text-block";
    
        div.id = getBlockId(this.id);
        div.title = div.id
    
        divMath.insertBefore(div, nextEle);
    
        div.tabIndex = 0;
    
        const html = makeHtmlLines(text);
        div.innerHTML = html;
        reprocessMathJax(html);

        return div;
    }


    clear(){
        divMath.removeChild(this.div);
    }
}

export class TextBlockAction extends DivAction {
    constructor(text: string){
        super();

        this.text = text;
        //---------- 
        msg(`append text block[${this.text}]`);
    
        this.div = this.makeTextDiv(this.text);
        this.div.addEventListener("click", function(ev:MouseEvent){
            onclickBlock(this, ev);
        });
    
        this.div.addEventListener('keydown', (event) => {
            msg(`key down ${event.key} ${event.ctrlKey}`);
        }, false);

        return this;
    }

    makeObj(obj){
        Object.assign(obj, { text: this.text });
    }

    summary() : string {
        return `t ${this.id} ${this.text.split('\n').filter(x => x.trim() != "$$").join(' ').substring(0, 10)}`;
    }
}

export function newDocument(){
    ActionId = 0;
    actions = [];
    selections = [];
    tmpSelection = null;

    divActions.innerHTML = "";
    divMath.innerHTML = "";
    setTextMathValue("");
    divMsg.textContent = "";
}


function updateFocusedTextBlock(){
    const text = textMath.value.trim();
    const act = currentAction();

    if(act instanceof TextBlockAction){

        const html = makeHtmlLines(text);
        act.div.innerHTML = html;
        act.text = text;

        //++ divActions.children[focusedActionIdx].textContent = act.summary();

        reprocessMathJax(html);
    }
    else if(act instanceof SpeechAction){

        act.text = text;
    }

    selActions.selectedOptions[0].textContent = act.summary();
}

function updateTextMath(){
    if(prevTextValue != textMath.value && prevTextValue != textMath.value.trim()){

        let trimValue = textMath.value.trim();
        let selIdx = selActions.selectedIndex;
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

                        const newAct = new SpeechAction(textMath.value.trim());
                        setAction(newAct);    
                    }
                    else{

                        const newAct = new TextBlockAction(textMath.value);
                        newAct.init();                    
                        
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

        prevTextValue = textMath.value.trim();
    }
}

function monitorTextMath(){
    setInterval(updateTextMath, 500);

    textMath.addEventListener("keydown", (ev: KeyboardEvent)=>{
        msg(`key down ${ev.key}`);
        if(ev.key == "Insert"){
            if(ev.ctrlKey){

                textMath.value = "$$\n\\frac{1}{2 \\pi \\sigma^2} \\int_{-\\infty}^\\infty \\exp^{ - \\frac{{(x - \\mu)}^2}{2 \\sigma^2}  } dx\n$$";
            }
        }
    })

    textMath.addEventListener("keypress", function(ev:KeyboardEvent){
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

    textMath.addEventListener("blur", (ev: FocusEvent)=>{
        msg("blur");
        updateFocusedTextBlock();
    });
}

function currentAction() : Action | undefined {
    if(selActions.selectedIndex != -1){
        return actions[selActions.selectedIndex];
    }
    else{
        return undefined;
    }

}

function setAction(act: Action){
    let selIdx = selActions.selectedIndex;

    console.assert(actions[selIdx] instanceof EmptyAction);
    actions[selIdx] = act;
    selActions.options[selIdx].textContent = act.summary();
}

function addEmptyAction(){
    const act = new EmptyAction();
    let selIdx = selActions.selectedIndex;

    actions.splice(selIdx + 1, 0, act);

    let opt = document.createElement("option");
    opt.textContent = act.summary();

    if(selIdx != -1 && selIdx + 1 < selActions.options.length){

        selActions.options.add(opt, selActions.options[selIdx + 1]);
    }
    else{

        selActions.options.add(opt);
    }

    selActions.selectedIndex = selIdx + 1;

    setTextMathValue("");
    textMath.focus();
}


function resetAction(){
    let selIdx = selActions.selectedIndex;

    const act = actions[selIdx] as TextBlockAction;
    if(act instanceof TextBlockAction){

        divMath.removeChild(act.div);
    }

    actions[selIdx] = new EmptyAction();
    selActions.options[selIdx].textContent = actions[selIdx].summary();
}


function removeAction(){
    let selIdx = selActions.selectedIndex;

    const act = actions[selIdx] as TextBlockAction;

    actions.splice(selIdx, 1);
    //++ divActions.removeChild(divActions.children[focusedActionIdx]);

    if(act instanceof TextBlockAction){

        divMath.removeChild(act.div);
    }

    selActions.remove(selIdx);
    if(selIdx == 0){

        if(selActions.options.length == 0){

            selActions.selectedIndex = - 1;
        }
        else{

            selActions.selectedIndex = 0;
        }
    }
    else{

        selActions.selectedIndex = selIdx - 1;
    }
}

function selActionsChange(ev: Event){
    msg(`changed`);
    while(actions.some(x => x instanceof EmptyAction)){
        let idx = actions.findIndex(x => x instanceof EmptyAction);
        actions.splice(idx, 1);
        selActions.remove(idx);
    }

    const act = actions[selActions.selectedIndex];
    if(act instanceof TextBlockAction || act instanceof SpeechAction){

        setTextMathValue(act.text);
    }
    else{
        setTextMathValue("");
    }
}

export function addSelection(){
    if(tmpSelection == null){
        return;
    }

    tmpSelection.isTmp = false;
    tmpSelection.enable();
    setAction(tmpSelection);

    tmpSelection = null;
}

export function initTekesan(in_editor: boolean){
    inEditor = in_editor;
    divMsg = document.getElementById("div-msg") as HTMLDivElement;
    divMath = document.getElementById("div-math") as HTMLDivElement;
    divActions = document.getElementById("div-actions") as HTMLDivElement;
    textMath = document.getElementById("txt-math") as HTMLTextAreaElement;
    selActions = document.getElementById("sel-actions") as HTMLSelectElement;
    let selIdx = selActions.selectedIndex;

    msg("body loaded");

    initSpeech();

    speechInput = false;
    textMath.style.backgroundColor = "white";
    newDocument();

    if(! inEditor){
        return;
    }

    document.body.addEventListener("keydown", (ev: KeyboardEvent)=>{
        if(ev.key == "Insert" && ! ev.ctrlKey && ! ev.shiftKey){
            speechInput = ! speechInput;
            const inputMode = document.getElementById("input-mode") as HTMLSpanElement;
            inputMode.textContent = (speechInput ? "音声" : "テキスト");
            if(speechInput){
                textMath.style.backgroundColor = "ivory";
            }
            else{

                textMath.style.backgroundColor = "white";
            }
        }
    })

    selActions.addEventListener("change", selActionsChange);
    selActions.addEventListener("dblclick", (ev: MouseEvent)=>{
        msg("dblclick");
        addEmptyAction();
    });
 
    monitorTextMath();

    addEmptyAction();
}


}
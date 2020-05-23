import { UI, colors, Action, EmptyAction, TextBlockAction, SelectionAction, TextAction, SpeechAction, getBlockId, idPrefix, reprocessMathJax } from "./main";
import { fetchText, reviseJson, last, makeHtmlLines, msg, runGenerator } from "./util";
import { initSpeech } from "./speech";
import { configureStore, createSlice } from '@reduxjs/toolkit'

export let speechInput : boolean;

// namespace bansho {

export class UIEdit extends UI {
    selColors: HTMLInputElement[];
    lineFeedChk : HTMLInputElement;
    textArea : HTMLTextAreaElement;
    txtTitle: HTMLInputElement;
    summary : HTMLSpanElement;

    constructor(div: HTMLDivElement, title: HTMLInputElement, selColors: HTMLInputElement[], summary : HTMLSpanElement, textArea : HTMLTextAreaElement){
        super(div);
        this.txtTitle = title;
        this.selColors = selColors;
        this.lineFeedChk = document.getElementById("line-feed") as HTMLInputElement;
        this.summary = summary;
        this.textArea = textArea;

        this.textArea.style.backgroundColor = "white";

        // colors = this.selColors.map(x => x.value);

        this.actions = [];

        this.board.innerHTML = "";
        this.updateSummaryTextArea();

        this.addEmptyAction();
        this.selectColor = this.getSelectColor();

        let path = div.getAttribute("data-path");
        if(path != null){

            this.openDoc(path);
        }
    }

    getSelectColor(){
        return colors.indexOf( this.selColors.find(x => x.checked)!.value );
    }

    addAction(act: Action){
        let selIdx = this.timeline.valueAsNumber + 1;
    
        this.actions.splice(selIdx, 0, act);
    
        this.timeline.max = `${this.actions.length - 1}`;
        this.updateTimePos(selIdx);
    
        this.textArea.focus();
    }

    setAction(act: Action){
        let selIdx = this.timeline.valueAsNumber;

        console.assert(this.actions[selIdx] instanceof EmptyAction);
        this.actions[selIdx] = act;
        this.summary.textContent = act.summary();
    }

    resetAction(){
        let selIdx = this.timeline.valueAsNumber;

        const act = this.actions[selIdx] as TextBlockAction;
        if(act instanceof TextBlockAction){

            this.board.removeChild(act.div);
        }

        this.actions[selIdx] = new EmptyAction(this);
        this.summary.textContent = this.actions[selIdx].summary();
    }

    addEmptyAction(){
        this.addAction(new EmptyAction(this));
    }

    deleteAction(){
        if(this.timeline.valueAsNumber == -1){
            return;
        }

        let fnc = (act: Action)=>{

            const refActs = this.actions.filter(x => x instanceof SelectionAction && x.refId == act.id) as SelectionAction[];

            refActs.forEach(x => fnc(x));

            act.disable();
            if(act instanceof TextBlockAction){

                this.board.removeChild(act.div);
            }
        
            let idx = this.actions.indexOf(act);
            console.assert(idx != -1);
            this.actions.splice(idx, 1);
        }

        fnc(this.actions[this.timeline.valueAsNumber]);

        let selIdx = this.timeline.valueAsNumber;
        this.timeline.max = `${this.actions.length - 1}`;

        if(selIdx < this.actions.length){
            this.actions[selIdx].enable();
        }

        this.updateTimePos( Math.min(selIdx, this.actions.length - 1) );
    }

    updateTimePos(pos: number){
        super.updateTimePos(pos);

        let act = this.currentAction();

        if(act instanceof TextBlockAction){

            this.lineFeedChk.parentElement!.style.display = "inline";
            this.lineFeedChk.checked = act.lineFeed;
        }
        else if(act instanceof SpeechAction){

        }
        else{

            this.lineFeedChk.parentElement!.style.display = "none";
        }

        this.updateSummaryTextArea();
    }

    updateSummaryTextArea(){
        this.textArea.style.backgroundColor = "white";
        this.textArea.value = "";
        this.summary.textContent = "";

        if(this.timeline.valueAsNumber != -1){

            const act = this.actions[this.timeline.valueAsNumber];
            if(act instanceof TextAction){

                this.textArea.value = act.text;

                if(act instanceof SpeechAction){
                    this.textArea.style.backgroundColor = "ivory";
                }
            }

            this.summary.textContent = act.summary();
        }
    }

    updateFocusedTextBlock(){
        const text = this.textArea.value.trim();
        const act = this.currentAction()!;

        if(act instanceof TextBlockAction){

            const html = makeHtmlLines(text);
            act.div.innerHTML = html;
            act.text = text;

            reprocessMathJax(act, act.div, html);
        }

        this.summary.textContent = act.summary();
    }

    updateTextMath(){
        const act = this.currentAction();
        if(act == undefined || act instanceof SpeechAction){
            return;
        }
        
        let text = this.textArea.value.trim();

        if(act instanceof EmptyAction){
            // 空のアクションの場合

            if(text != ""){

                if(speechInput){

                    const newAct = new SpeechAction(this, text);
                    this.setAction(newAct);    
                }
                else{

                    const newAct = new TextBlockAction(this, text);
                    
                    this.setAction(newAct);                    
                }
            }
        }
        else if(act instanceof TextBlockAction){

            if(text == ""){
                // テキストが削除された場合

                this.resetAction();
            }
            else{
                // テキストがある場合

                let changed = (act.text != text);

                if(act.lineFeed != (act.div.getElementsByClassName("line-feed").length != 0)){

                    changed = true;
                }

                if(changed){
                    // テキストか改行が変更された場合

                    act.text = text;
                    this.updateFocusedTextBlock();
                }
            }
        }
    }

    textAreaKeyDown(ev: KeyboardEvent){
        msg(`key down ${ev.key}`);
        if(ev.key == "Insert"){
            if(ev.ctrlKey){

                this.textArea.value = "$$\n\\frac{1}{2 \\pi \\sigma^2} \\int_{-\\infty}^\\infty \\exp^{ - \\frac{{(x - \\mu)}^2}{2 \\sigma^2}  } dx\n$$";
            }
        }
    }

    textAreaKeyPress(ev: KeyboardEvent){
        msg(`key press ${ev.ctrlKey} ${ev.key}`);
        if((ev.ctrlKey || ev.shiftKey) && ev.code == "Enter"){

            let act = this.currentAction();

            if(act instanceof TextBlockAction){
            
                act.lineFeed = true;
            }

            this.updateTextMath();

            if(act instanceof SpeechAction){
                runGenerator( act.play() );
            }

            this.addEmptyAction();

            ev.stopPropagation();
            ev.preventDefault();
        }
    }

    textAreaBlur(ev: FocusEvent){
        msg("blur");
        this.updateTextMath();
    }

    serializeDoc(title: string) : string {
        return `{
      "title": "${title}",
      "actions": [
    ${this.actions.filter(x => !(x instanceof EmptyAction)) .map(x => "    " + x.toStr()).join(",\n")}
      ]
    }`
    }
    
    renumId(){
        for(let [id, act] of this.actions.entries()){
            if(act instanceof TextBlockAction){
                act.div.id = getBlockId(id);
            }
            else if(act instanceof SelectionAction){
                const block = this.actions.find(x => x.id == (act as SelectionAction).refId);
                console.assert(block != undefined);
    
                act.refId = this.actions.indexOf(block!);
                console.assert(act.refId != -1);
            }
        }
    
        for(let [id, act] of this.actions.entries()){
            act.id = id;
        }
    }

    backup(path: string){
        this.renumId();

        const text = this.serializeDoc(this.txtTitle.value.trim());
        msg(`[${text}]`);
    
        navigator.clipboard.writeText(text).then(function() {
            msg("copy OK");
        }, function() {
            msg("copy NG");
        });
    
        var url = `${window.location.origin}/`;
        var data = {
            "path": path,
            "text": text,
        };
        
        fetch(url, {
            method: "POST", // or 'PUT'
            body: JSON.stringify(data),
            headers:{
                'Content-Type': 'application/json'
            }
        })
        .then(res => res.json())
        .then(response => {
            console.log('Success:', JSON.stringify(response))
        })
        .catch(error => {
            console.error('Error:', error)
        });
    }

    setTextBlockEventListener(act: TextBlockAction){
        setTextBlockEventListener(act);
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
                // let sel = obj as SelectionAction;
                // act = new SelectionAction(this, sel.refId, sel.domType, sel.startIdx, sel.endIdx, sel.color);
                continue;
    
            case "disable":
                continue;
    
            default:
                console.assert(false);
                return;
            }
            // console.assert(act.id == id);
    
            this.actions.push(act);
    
            this.timeline.max = `${this.actions.length - 1}`;
            this.timeline.valueAsNumber = this.actions.length - 1;
        }
    
        if(UIEdit != undefined && this instanceof UIEdit){
    
            this.summary.textContent = last(this.actions).summary();
        }
    
        this.timeline.max = `${this.actions.length - 1}`;
        this.updateTimePos(-1);    
        this.onOpenDocComplete();
    }

}

declare let MathJax:any;

function getActionId(id: string) : number {
    console.assert(id.startsWith(idPrefix));
    return parseInt(id.substring(idPrefix.length));
}


let selAct: SelectionAction | null = null;

export function onClickPointerMove(act:TextBlockAction, ev: PointerEvent | MouseEvent, is_click: boolean){
    for(let ele = ev.srcElement as HTMLElement; ele; ele = ele.parentElement!){
        if([ "MJX-MI", "MJX-MN", "MJX-MO" ].includes(ele.tagName)){

            let v = Array.from(act.div.querySelectorAll('MJX-MI, MJX-MN, MJX-MO')) as HTMLElement[];
            let i = v.indexOf(ele);
            console.assert(i != -1);

            if(is_click){

                if(selAct == null){

                    selAct = new SelectionAction(act.ui, getActionId(act.div.id), "math", i, i + 1, act.ui.selectColor);
                    selAct.enable();

                    (act.ui as UIEdit).addAction(selAct);
                }
                else{
                    selAct = null;
                }
            }
            else{
                
                selAct!.endIdx = Math.max(i, selAct!.startIdx) + 1;
                selAct!.moveBorder();
            }


            msg(`${ele.tagName}`);
            break;
        }
        else{

            msg(`${ele.tagName}`);
            if(! ele.tagName.startsWith("MJX-")){
                break;
            }
        }
    }
}

export function onPointerMove(act:TextBlockAction, ev: PointerEvent){
    if(selAct == null){
        return;
    }
    onClickPointerMove(act, ev, false);
}

export function onClickBlock(act:TextBlockAction, ev:MouseEvent){
    msg("clicked");
    ev.stopPropagation();
    onClickPointerMove(act, ev, true);
}


export function initEdit(div: HTMLDivElement, txtTitle: HTMLInputElement, selColors: HTMLInputElement[], summary : HTMLSpanElement, textArea : HTMLTextAreaElement) : UIEdit {
    initRedux();

    initSpeech();

    msg("body loaded");

    return new UIEdit(div, txtTitle, selColors, summary, textArea);
}

function initRedux(){
    console.log("hello body");

    // let RTK = {
    //   "createSlice": createSlice,
    //   "configureStore": configureStore
    // }
    // const RTK = (window  as any).RTK;

    const counterSlice = createSlice({
        name: "counter",
        initialState: 0,
        reducers: {
            increment: (state: number) => {
                msg("inc");
                return state + 1;
            },
            decrement: (state: number) => {
                msg("dec");
                return state - 1;
            }
        }
    });

    const { increment, decrement } = counterSlice.actions;

    const store = configureStore({ reducer: counterSlice.reducer });
    const valueEl = document.getElementById("value")!;

    function render() {
        msg("render");
        valueEl.innerHTML = store.getState().toString();
    }

    render();
    store.subscribe(render);

    document.getElementById("increment")!.addEventListener("click", function() {
        store.dispatch(increment());
        store.dispatch(increment());
    });

    document.getElementById("decrement")!.addEventListener("click", function() {
        store.dispatch(decrement());
    });

    document.getElementById("incrementIfOdd")!.addEventListener("click", function() {
        if (store.getState() % 2 !== 0) {
          store.dispatch(increment());
        }
    });

    document.getElementById("incrementAsync")!.addEventListener("click", function() {
        setTimeout(function() {
          store.dispatch(increment());
        }, 1000);
    });
}

let ui: UIEdit;

function setEventListener(){
    ui.btnPlayPause.addEventListener("click", (ev: MouseEvent)=>{
        ui.clickPlayPause();
    });

    ui.timeline.addEventListener("change", (ev: Event)=>{
        ui.rngTimelineChange();
    });

    document.getElementById("add-empty-action")!.addEventListener("click", (ev: MouseEvent)=>{
        ui.addEmptyAction();
    });

    document.getElementById("update-time-pos")!.addEventListener("click", (ev: MouseEvent)=>{
        ui.updateTimePos(-1);
    });

    document.getElementById("get-data")!.addEventListener("click", (ev: MouseEvent)=>{
        getData();
    });

    document.getElementById("delete-action")!.addEventListener("click", (ev: MouseEvent)=>{
        ui.deleteAction();
    });

    document.getElementById("put-data")!.addEventListener("click", (ev: MouseEvent)=>{
        putData();
    });
}

function setTextBlockEventListener(act: TextBlockAction){
    act.div.addEventListener("click", (ev:MouseEvent)=>{
        onClickBlock(act, ev);
    });

    act.div.addEventListener("pointermove", (ev: PointerEvent)=>{
        onPointerMove(act, ev);
    });

    act.div.addEventListener('keydown', (ev) => {
        msg(`key down ${ev.key} ${ev.ctrlKey}`);

        if(ev.key == "Delete" && ! ev.ctrlKey && ! ev.shiftKey){
            ev.stopPropagation();
            ev.preventDefault();

            let ele = ev.srcElement as HTMLElement;
            msg(`del ${ele.tagName} ${ele.id}`);
        }
    }, false);
}

// import {ShoppingList} from "./form.tsx"

export function setUIEditEventListener(){
    // let a = new ShoppingList();

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

    ui.lineFeedChk.addEventListener("change", (ev: Event)=>{
        let act = ui.currentAction();
        if(act instanceof TextBlockAction){

            act.lineFeed = ui.lineFeedChk.checked;
            act.updateLineFeed();
        }
        else{
            console.assert(false);
        }
    })

    for(let inp of ui.selColors){
        inp.addEventListener("click", (ev: MouseEvent)=>{
            ui.selectColor = ui.getSelectColor();

            let act = ui.currentAction();
            if(act instanceof SelectionAction){
                act.color = ui.selectColor;
                act.enable();
            }
        });
    }

    ui.textArea.addEventListener("keydown", (ev: KeyboardEvent)=>{
        ui.textAreaKeyDown(ev);
    })

    ui.textArea.addEventListener("keypress", (ev:KeyboardEvent)=>{
        ui.textAreaKeyPress(ev);
    });

    ui.textArea.addEventListener("blur", (ev: FocusEvent)=>{
        ui.textAreaBlur(ev);
    });

    setInterval(()=>{
        ui.updateTextMath();
    }, 500);
}

export function bodyOnload(){
    console.log("body load");

    speechInput = false;

    let div = document.getElementById("bansho") as HTMLDivElement;
    let txtTitle = document.getElementById("txt-title") as HTMLInputElement;
    let selColors = [
        document.getElementById("color-0") as HTMLInputElement,
        document.getElementById("color-1") as HTMLInputElement,
        document.getElementById("color-2") as HTMLInputElement
    ];
    let summary  = document.getElementById("spn-summary") as HTMLSpanElement;
    let textArea = document.getElementById("txt-math") as HTMLTextAreaElement;

    ui = initEdit(div, txtTitle, selColors, summary, textArea);

    setEventListener();
    setUIEditEventListener();
}

function getData(){
    let path  = (document.getElementById("txt-path") as HTMLInputElement).value.trim();
    ui.openDoc(path);
}

function putData(){
    let path  = (document.getElementById("txt-path") as HTMLInputElement).value.trim();
    ui.backup(path);
}


export function initPlayer(){
    initSpeech();

    msg("body loaded");
   
    let divs = Array.from(document.getElementsByClassName("bansho")) as HTMLDivElement[];

    if(window.location.search != ""){
        console.assert(window.location.search[0] == '?');

        for(let item of window.location.search.substring(1).split('&')){
            let [key, value] = item.split("=");
            if(key == "path"){
                let div = divs[0];

                // let ui = new UIEdit(div);
                // ui.openDoc(value);
            }
        }
    }
    else{

        for(let div of divs){

            let ui = new UI(div);
        }
    }
}

// }
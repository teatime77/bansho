namespace bansho {
let speechInput : boolean;
export let selectColor : number;

export class UIEdit extends UI {
    txtTitle: HTMLInputElement;
    selColors: HTMLInputElement[];
    lineFeedChk : HTMLInputElement;
    summary : HTMLSpanElement;
    textArea : HTMLTextAreaElement;

    constructor(div: HTMLDivElement, title: HTMLInputElement, selColors: HTMLInputElement[], summary : HTMLSpanElement, textArea : HTMLTextAreaElement){
        super(div);
        speechInput = false;
        this.txtTitle = title;
        this.selColors = selColors;
        this.lineFeedChk = document.getElementById("line-feed") as HTMLInputElement;
        this.summary = summary;
        this.textArea = textArea;

        this.textArea.style.backgroundColor = "white";

        document.body.addEventListener("keydown", (ev: KeyboardEvent)=>{
            if(ev.key == "Insert" && ! ev.ctrlKey && ! ev.shiftKey){
                speechInput = ! speechInput;
                if(speechInput){
                    this.textArea.style.backgroundColor = "ivory";
                }
                else{

                    this.textArea.style.backgroundColor = "white";
                }
            }
        });

        this.lineFeedChk.addEventListener("change", (ev: Event)=>{
            let act = this.currentAction();
            if(act instanceof TextBlockAction){

                act.lineFeed = this.lineFeedChk.checked;
                act.updateLineFeed();
            }
            else{
                console.assert(false);
            }
        })

        colors = this.selColors.map(x => x.value);

        selectColor = this.getSelectColor();
        this.selColors.forEach(inp =>{
            inp.addEventListener("click", (ev: MouseEvent)=>{
                selectColor = this.getSelectColor();

                let act = this.currentAction();
                if(act instanceof SelectionAction){
                    act.color = selectColor;
                    act.enable();
                }
            })
        });

        this.actions = [];

        this.board.innerHTML = "";
        this.updateSummaryTextArea();

        this.monitorTextMath();

        this.addEmptyAction();
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
        else{

            this.lineFeedChk.parentElement!.style.display = "none";
        }
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
        else{
            console.assert(false);
        }
    }

    monitorTextMath(){
        setInterval(this.updateTextMath.bind(this), 500);

        this.textArea.addEventListener("keydown", (ev: KeyboardEvent)=>{
            msg(`key down ${ev.key}`);
            if(ev.key == "Insert"){
                if(ev.ctrlKey){

                    this.textArea.value = "$$\n\\frac{1}{2 \\pi \\sigma^2} \\int_{-\\infty}^\\infty \\exp^{ - \\frac{{(x - \\mu)}^2}{2 \\sigma^2}  } dx\n$$";
                }
            }
        })

        this.textArea.addEventListener("keypress", (ev:KeyboardEvent)=>{
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
        });

        this.textArea.addEventListener("blur", (ev: FocusEvent)=>{
            msg("blur");
            this.updateTextMath();
        });
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

}

declare let MathJax:any;

function getActionId(id: string) : number {
    console.assert(id.startsWith(idPrefix));
    return parseInt(id.substring(idPrefix.length));
}

let typesetAct : Action | null = null;
let typesetQue : [Action, HTMLElement, string][] = [];

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
                if(typesetAct instanceof TextBlockAction){
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

export function reprocessMathJax(act: Action, div: HTMLDivElement | HTMLSpanElement, html: string){
    typesetQue.push([act, div, html]);
    popQue();
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

                    selAct = new SelectionAction(act.ui, getActionId(act.div.id), "math", i, i + 1, selectColor);
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



}
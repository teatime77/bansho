namespace tekesan {
let speechInput : boolean;
let prevTextValue: string = "";
export let selectColor : number;

export class UIEdit extends UI {
    txtTitle: HTMLInputElement;
    selColors: HTMLInputElement[];
    summary : HTMLSpanElement;
    textArea : HTMLTextAreaElement;

    constructor(div: HTMLDivElement, title: HTMLInputElement, selColors: HTMLInputElement[], summary : HTMLSpanElement, textArea : HTMLTextAreaElement){
        super(div);
        speechInput = false;
        this.txtTitle = title;
        this.selColors = selColors;
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

            const refActs = this.actions.filter(x => x instanceof RefAction && x.refId == act.id) as RefAction[];

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

        prevTextValue = this.textArea.value;
    }

    updateFocusedTextBlock(){
        const text = this.textArea.value.trim();
        const act = this.currentAction();

        if(act instanceof TextBlockAction){

            const html = makeHtmlLines(text);
            act.div.innerHTML = html;
            act.text = text;

            reprocessMathJax(this, html);
        }
        else if(act instanceof SpeechAction){

            act.text = text;
        }
        else{
            return;
        }

        this.summary.textContent = act.summary();
    }

    updateTextMath(){
        if(prevTextValue != this.textArea.value && prevTextValue != this.textArea.value.trim()){

            let trimValue = this.textArea.value.trim();
            let selIdx = this.timeline.valueAsNumber;
            const act = this.actions[selIdx];

            if(trimValue == ""){
                // テキストが削除された場合

                if(!(act instanceof EmptyAction)){
                    // 空のアクションでない場合

                    this.resetAction();
                }
            }
            else{
                // テキストが変更された場合

                if(prevTextValue == ""){
                    // 新たにテキストを入力した場合

                    if(act instanceof EmptyAction){
                        // 空のアクションの場合

                        if(speechInput){

                            const newAct = new SpeechAction(this, this.textArea.value.trim());
                            this.setAction(newAct);    
                        }
                        else{

                            const newAct = new TextBlockAction(this, this.textArea.value);
                            
                            this.setAction(newAct);                    
                        }
                    }
                    else{
                        // 空のアクションでない場合

                        this.updateFocusedTextBlock();
                    }
                }
                else{

                    this.updateFocusedTextBlock();
                }
            }

            prevTextValue = this.textArea.value.trim();
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
            if(ev.ctrlKey && ev.code == "Enter"){
                this.updateTextMath();

                let act = this.currentAction();
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
            if(this.timeline.valueAsNumber != -1){

                this.updateFocusedTextBlock();
            }
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
            else if(act instanceof DisableAction){
    
                act.refId = this.actions.indexOf(act.disableAct);
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
}
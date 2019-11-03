namespace tekesan {
let speechInput : boolean;
let prevTextValue: string = "";
export let selectColor : number;

function currentAction() : Action | undefined {
    if(ui.timeline.valueAsNumber != -1){
        return actions[ui.timeline.valueAsNumber];
    }
    else{
        return undefined;
    }
}

function setAction(act: Action){
    let selIdx = ui.timeline.valueAsNumber;

    console.assert(actions[selIdx] instanceof EmptyAction);
    actions[selIdx] = act;
    ui.summary.textContent = act.summary();
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

function setTextMathValue(text: string){
    ui.textArea.value = text;
    prevTextValue = text;
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
        if(ui.timeline.valueAsNumber != -1){

            updateFocusedTextBlock();
        }
    });
}

export function initEdit(){
    speechInput = false;

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

    actions = [];

    ui.board.innerHTML = "";
    setTextMathValue("");

    monitorTextMath();

    addEmptyAction();
}

}
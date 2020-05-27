namespace bansho {

export function setEventListener(ui: UI){
    ui.btnPlayPause.addEventListener("click", (ev: MouseEvent)=>{
        ui.clickPlayPause();
    });

    glb.timeline.addEventListener("change", (ev: Event)=>{
        ui.rngTimelineChange();
    });

    document.getElementById("add-empty-action")!.addEventListener("click", (ev: MouseEvent)=>{
        ui.addEmptyWidget();
    });

    document.getElementById("update-time-pos")!.addEventListener("click", (ev: MouseEvent)=>{
        ui.updateTimePos(-1);
    });

    document.getElementById("get-data")!.addEventListener("click", (ev: MouseEvent)=>{
        getData();
    });

    document.getElementById("delete-action")!.addEventListener("click", (ev: MouseEvent)=>{
        ui.deleteWidget();
    });

    document.getElementById("put-data")!.addEventListener("click", (ev: MouseEvent)=>{
        putData();
    });
}
    

export function setUIEditEventListener(ui: UI){
    // let a = new ShoppingList();

    document.body.addEventListener("keydown", (ev: KeyboardEvent)=>{
        if(ev.key == "Insert" && ! ev.ctrlKey && ! ev.shiftKey){
            glb.speechInput = ! glb.speechInput;
            if(glb.speechInput){
                ui.textArea.style.backgroundColor = "ivory";
            }
            else{

                ui.textArea.style.backgroundColor = "white";
            }
        }
    });

    ui.lineFeedChk.addEventListener("change", (ev: Event)=>{
        let act = ui.currentWidget();
        if(act instanceof TextBlockWidget){

            act.lineFeed = ui.lineFeedChk.checked;
            act.updateLineFeed();
        }
        else{
            console.assert(false);
        }
    })

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

export function setTextBlockEventListener(act: TextBlockWidget){
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

declare let MathJax:any;

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

}
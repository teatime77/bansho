namespace bansho {

let prevCharIndex = 0;
export let TemporarySelections: TextSelection[] = [];

export function setEventListener(){
    // 再生 / 停止ボタン
    glb.btnPlayPause.addEventListener("click", (ev: MouseEvent)=>{
        glb.clickPlayPause();
    });

    // タイムライン
    glb.timeline.addEventListener("change", (ev: Event)=>{
        glb.rngTimelineChange();
    });

    // ➕ ウイジェットの追加
    document.getElementById("add-empty-action")!.addEventListener("click", (ev: MouseEvent)=>{
        glb.addEmptyWidget();
    });

    // ⏮
    document.getElementById("update-time-pos")!.addEventListener("click", (ev: MouseEvent)=>{
        glb.updateTimePos(-1);
    });

    // 開くボタン
    document.getElementById("get-data")!.addEventListener("click", (ev: MouseEvent)=>{
        getData();
    });

    // 削除ボタン
    document.getElementById("delete-action")!.addEventListener("click", (ev: MouseEvent)=>{
        glb.deleteWidget();
    });

    // 保存ボタン
    document.getElementById("put-data")!.addEventListener("click", (ev: MouseEvent)=>{
        putData();
    });
}
    

export function setUIEditEventListener(){

    // BODY キーダウン
    document.body.addEventListener("keydown", (ev: KeyboardEvent)=>{
        if(ev.key == "Insert" && ! ev.ctrlKey && ! ev.shiftKey){
            glb.speechInput = ! glb.speechInput;
            if(glb.speechInput){
                glb.textArea.style.backgroundColor = "ivory";
            }
            else{

                glb.textArea.style.backgroundColor = "white";
            }
        }
    });

    // 改行 チェックボックス
    glb.lineFeedChk.addEventListener("change", (ev: Event)=>{
        let act = glb.currentWidget();
        if(act instanceof TextBlock){

            act.lineFeed = glb.lineFeedChk.checked;
            act.updateLineFeed();
        }
        else{
            console.assert(false);
        }
    })

    // TEXTAREA キー ダウン
    glb.textArea.addEventListener("keydown", (ev: KeyboardEvent)=>{
        glb.textAreaKeyDown(ev);
    })

    // TEXTAREA キー プレス
    glb.textArea.addEventListener("keypress", (ev:KeyboardEvent)=>{
        glb.textAreaKeyPress(ev);
    });

    // TEXTAREA BLUR
    glb.textArea.addEventListener("blur", (ev: FocusEvent)=>{
        glb.textAreaBlur(ev);
    });

    // タイマー処理
    setInterval(()=>{
        glb.updateTextMath();
    }, 500);
}

export function setTextBlockEventListener(act: TextBlock){
    // テキストブロック クリック
    act.div.addEventListener("click", (ev:MouseEvent)=>{
        onClickBlock(act, ev);
    });

    // テキストブロック ポインター移動
    act.div.addEventListener("pointermove", (ev: PointerEvent)=>{
        onPointerMove(act, ev);
    });

    // テキストブロック キーダウン
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

export function setSpeechEventListener(uttr: SpeechSynthesisUtterance){
    // スピーチ 終了
    uttr.onend = function(ev: SpeechSynthesisEvent ) {
        isSpeaking = false;
        msg(`end: idx:${ev.charIndex} name:${ev.name} type:${ev.type} text:${ev.utterance.text.substring(prevCharIndex, ev.charIndex)}`);

        Array.from(TemporarySelections).forEach(x => x.disable());
        console.assert(TemporarySelections.length == 0);
    };

    // スピーチ 境界
    uttr.onboundary = function(ev: SpeechSynthesisEvent ) { 
        msg(`bdr: idx:${ev.charIndex} name:${ev.name} type:${ev.type} text:${ev.utterance.text.substring(prevCharIndex, ev.charIndex)}`);
        prevCharIndex = ev.charIndex;
    };
}

/**
 * プロパティのテキストのイベント処理
 */
export function setPropertyTextEventListener(obj: Widget, inp: HTMLInputElement, setter: Function){
    inp.addEventListener("blur", function(obj, inp, setter){
        return function(ev: FocusEvent){
            setter.apply(obj, [ inp.value ]);
        };
    
    }(obj, inp, setter));
}

/**
 * プロパティのブール値のイベント処理
 */
export function setPropertyCheckboxEventListener(obj: Widget, inp: HTMLInputElement, setter: Function){
    inp.addEventListener("click", (function(inp, setter){
        return function(ev: MouseEvent){
            setter.apply(obj, [ inp.checked ]);
        };
    })(inp, setter));

}


/**
 * プロパティのブール値のイベント処理
 */
export function setPropertySelectEventListener(obj: Widget, sel: HTMLSelectElement, setter: Function){
    sel.addEventListener("change",  (function(sel, setter){
        return function(ev: Event){
            setter.apply(obj, [ sel.selectedIndex ]);
        };
    })(sel, setter));
}


/**
 * tool-typeのクリック
 */
export function setToolTypeEventListener(){
    const toolTypes = document.getElementsByName("tool-type");
    for(let x of toolTypes){
        x.addEventListener("click", setToolType);
    }    
}

/**
 * Viewのイベント処理
 */
export function setViewEventListener(view: View){
    view.svg.addEventListener("click", svgClick);
    view.svg.addEventListener("pointermove", svgPointermove);  
}

/**
 * Pointのイベント処理
 */
export function setPointEventListener(point: Point){
    point.circle.addEventListener("pointerdown", point.pointerdown);
    point.circle.addEventListener("pointermove", point.pointermove);
    point.circle.addEventListener("pointerup", point.pointerup);
}

/**
 * Imageのイベント処理
 */
export function setImageEventListener(img: Image){
    img.image.addEventListener("load", img.load);
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

        let selections = glb.widgets.filter(x => x instanceof TextSelection && x.textAct == typesetAct) as TextSelection[];
        selections.forEach(x => { x.border = null; });

        if(text.includes("$")){

            MathJax.typesetPromise([div])
            .then(() => {
                if(typesetAct instanceof TextBlock){
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
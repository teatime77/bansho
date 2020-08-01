namespace bansho {

let prevCharIndex = 0;
export let TemporarySelections: TextSelection[] = [];

export function setEventListener(){
    // 再生 / 停止ボタン
    glb.btnPlayPause.addEventListener("click", (ev: MouseEvent)=>{
        glb.clickPlayPause();
    });

    // ⏮
    document.getElementById("fast-reverse")!.addEventListener("click", (ev: MouseEvent)=>{
        if(Glb.edit){

            glb.selSummary.selectedIndex = -1;
        }
        glb.updateTimePos(-1, false);
    });

    // ⏭
    document.getElementById("fast-forward")!.addEventListener("click", (ev: MouseEvent)=>{
        if(Glb.edit){

            glb.selSummary.selectedIndex = glb.selSummary.options.length - 1;
        }
        glb.updateTimePos(glb.widgets.length - 1, false);
    });

    if(! Glb.edit){
        return;
    }

    // タイムライン
    if(glb.timeline != null){

        glb.timeline.addEventListener("change", (ev: Event)=>{
            glb.selSummary.selectedIndex = getTimePos() + 1;
            glb.rngTimelineChange();
        });
    }

    // 要約一覧
    glb.selSummary.addEventListener("change", (ev: Event)=>{
        msg("要約一覧 change");
        setTimePos(glb.selSummary.selectedIndex - 1);
        glb.rngTimelineChange();
    });

    // Viewの追加
    document.getElementById("add-shape")!.addEventListener("click", (ev: MouseEvent)=>{
        const view1 = new View().make({ Width: 500, Height: 500, ViewBox: "-2 -2 4 4" });
        glb.addWidget(view1);
    });

    //  テキストブロックの追加
    document.getElementById("add-text-block")!.addEventListener("click", (ev: MouseEvent)=>{
        let act = new TextBlock("$$\n\n$$");
        act.enable();

        glb.addWidget(act);
    });

    // スピーチの追加
    document.getElementById("add-speech")!.addEventListener("click", (ev: MouseEvent)=>{
        glb.addWidget(new Speech("🔊"));
    });

    // 新規ボタン
    document.getElementById("new-doc")!.addEventListener("click", (ev: MouseEvent)=>{
        putData("");
    });

    // 開くボタン
    document.getElementById("get-doc")!.addEventListener("click", (ev: MouseEvent)=>{
        glb.txtFile.value  = glb.selFile.value.trim();
        glb.openDoc(glb.txtFile.value);
    });

    // 保存ボタン
    document.getElementById("put-doc")!.addEventListener("click", (ev: MouseEvent)=>{
        let path  = glb.txtFile.value.trim();
        console.assert(path != "");
        putData(path);
    });

    // タイトル
    glb.txtTitle.addEventListener("focus", (ev: FocusEvent)=>{
        // フォーカス時にテキスト全体を選択する。
        glb.txtTitle.setSelectionRange(0, glb.txtTitle.value.length);
    })

    // 削除ボタン
    document.getElementById("delete-action")!.addEventListener("click", (ev: MouseEvent)=>{
        glb.deleteWidget();
    });

    // ファイルリスト
    glb.selFile.addEventListener("change", (ev: Event)=>{
        glb.txtFile.value = glb.selFile.value;
    })

    // TEXTAREA キー プレス
    glb.textArea.addEventListener("keypress", (ev:KeyboardEvent)=>{
        glb.textAreaKeyPress(ev);
    });

    let timeout_id: number = -1;

    // TEXTAREA BLUR
    glb.textArea.addEventListener("blur", (ev: FocusEvent)=>{
        if(timeout_id != -1){

            clearTimeout(timeout_id);
            timeout_id = -1;
        }

        glb.updateTextMath();
    });

    // TEXTAREA INPUT
    glb.textArea.addEventListener("input", (ev: Event)=>{
        if(timeout_id != -1){
            clearTimeout(timeout_id);
        }

        timeout_id = setTimeout(()=>{
            timeout_id = -1;
            glb.updateTextMath();
        }, 500);
    });

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
        glb.isSpeaking = false;
        msg(`speech end: idx:${ev.charIndex} name:${ev.name} type:${ev.type} text:${ev.utterance.text.substring(prevCharIndex, ev.charIndex)}`);

        Array.from(TemporarySelections).forEach(x => x.disable());
        console.assert(TemporarySelections.length == 0);

        deselectShape();

        if(glb.pauseFlag){
    
            glb.pauseFlag = false;
            glb.showPlayButton();
        }
        else{

            glb.playWidgets();
        }
    };

    // スピーチ 境界
    uttr.onboundary = function(ev: SpeechSynthesisEvent ) { 
        msg(`speech bdr: idx:${ev.charIndex} name:${ev.name} type:${ev.type} text:${ev.utterance.text.substring(prevCharIndex, ev.charIndex)}`);
        prevCharIndex = ev.charIndex;
    };
}

/**
 * プロパティのテキストのイベント処理
 */
export function setPropertyTextAreaEventListener(obj: Widget, inp: HTMLTextAreaElement, setter: Function){
    inp.addEventListener("blur", function(act, inp, setter){
        return function(ev: FocusEvent){
            setter.apply(act, [ inp.value ]);
            updateProperty(act);
            updateSummary(act);
        };
    
    }(obj, inp, setter));
}

/**
 * プロパティのテキストのイベント処理
 */
export function setPropertyTextEventListener(obj: Widget, inp: HTMLInputElement, setter: Function){
    inp.addEventListener("blur", function(act, inp, setter){
        return function(ev: FocusEvent){
            setter.apply(act, [ inp.value ]);
            updateProperty(act);
            updateSummary(act);
        };
    
    }(obj, inp, setter));
}

/**
 * プロパティのブール値のイベント処理
 */
export function setPropertyCheckboxEventListener(obj: Widget, inp: HTMLInputElement, setter: Function){
    inp.addEventListener("click", (function(act, inp, setter){
        return function(ev: MouseEvent){
            setter.apply(act, [ inp.checked ]);
            updateProperty(act);
            updateSummary(act);
        };
    })(obj, inp, setter));

}


/**
 * プロパティの列挙型のイベント処理
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
    view.svg.addEventListener("click", view.svgClick);
    view.svg.addEventListener("pointerdown", view.svgPointerDown);  
    view.svg.addEventListener("pointerup"  , view.svgPointerUp);  
    view.svg.addEventListener("pointermove", view.svgPointerMove);  
    view.svg.addEventListener("wheel"      , view.svgWheel);
}

/**
 * Pointのイベント処理
 */
export function setPointEventListener(point: Point){
    point.circle.addEventListener("pointerdown", point.pointerdown);
    point.circle.addEventListener("pointermove", point.pointermove);
    point.circle.addEventListener("pointerup"  , point.pointerup);
}

/**
 * ShapeのNameのイベント処理
 */
export function setNameEventListener(shape: Shape){
    shape.svgName!.addEventListener("pointerdown", shape.namePointerdown);
    shape.svgName!.addEventListener("pointermove", shape.namePointermove);
    shape.svgName!.addEventListener("pointerup"  , shape.namePointerup);
}

/**
 * ShapeのCaptionのイベント処理
 */
export function setCaptionEventListener(shape: Shape){
    shape.divCaption!.addEventListener("pointerdown", shape.captionPointerdown);
    shape.divCaption!.addEventListener("pointermove", shape.captionPointermove);
    shape.divCaption!.addEventListener("pointerup"  , shape.captionPointerup);
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
        div.innerHTML = text;

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

export function fetchFileList(fnc:(obj: any)=>void){
    let k = window.location.href.lastIndexOf("/");

    const url = `${window.location.href.substring(0, k)}/list`;
    const url2 = encodeURI(url);
    msg(`fetch-file names:${url} ${url2}`);
    fetch(url2)
    .then((res: Response) => {
        if(res.status == 404){

            fetchText(`list.json`, fnc);
    
            throw new Error("ファイルがありません。");
        }
        else{

            return res.text();
            // return res.json();
        }

    })
    .then(text => {
        fnc(JSON.parse(text));
    })
    .catch(error => {
        msg(`fetch file list error ${error}`);
    });

}

}
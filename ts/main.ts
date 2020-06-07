namespace bansho {

export class Glb {
    widgets : Widget[] = [];
    allWidgets : Widget[] = [];
    caption: HTMLHeadingElement;
    timeline : HTMLInputElement;
    board : HTMLDivElement;
    speechInput : boolean = false;
    ui: UI;
    widgetMap : Widget[] = [];
    refMap = new Map<number, Widget>();

    constructor(ui: UI){
        this.ui = ui;

        this.caption  = document.getElementById("caption") as HTMLHeadingElement;
        this.timeline = document.getElementById("timeline") as HTMLInputElement;
        this.board    = document.getElementById("board") as HTMLDivElement;
    }
}

export let glb: Glb;


export class UI {
    prevTimePos : number;
    pauseFlag : boolean;

    btnPlayPause: HTMLButtonElement;

    isPlaying = false;

    lineFeedChk : HTMLInputElement;
    textArea : HTMLTextAreaElement;
    txtTitle: HTMLInputElement;
    summary : HTMLSpanElement;

    constructor(){
        glb = new Glb(this);

        this.prevTimePos = -1;
        this.pauseFlag = false;

        this.btnPlayPause = document.getElementById("play-pause") as HTMLButtonElement;

        this.txtTitle = document.getElementById("txt-title") as HTMLInputElement;
        this.lineFeedChk = document.getElementById("line-feed") as HTMLInputElement;
        this.summary = document.getElementById("spn-summary") as HTMLSpanElement;
        this.textArea = document.getElementById("txt-math") as HTMLTextAreaElement;

        this.updateSummaryTextArea();

        this.addEmptyWidget();
    }
        
    onOpenDocComplete = ()=>{
        this.btnPlayPause.disabled = false;
        this.btnPlayPause.innerHTML = "▶️";
    }  

    clickPlayPause(){
        if(this.isPlaying){
    
            this.btnPlayPause.disabled = true;
            pauseWidget(this, ()=>{
                this.btnPlayPause.disabled = false;
                this.btnPlayPause.innerHTML = "▶️";
            });
        }
        else{
    
            this.btnPlayPause.innerHTML = "⏸";
            this.playWidgets(()=>{
    
                this.btnPlayPause.innerHTML = "▶️";
                this.isPlaying = false;
            });
        }
        this.isPlaying = ! this.isPlaying;
    }

    rngTimelineChange(){
        msg(`changed`);
        while(glb.widgets.some(x => x instanceof EmptyWidget)){
            let idx = glb.widgets.findIndex(x => x instanceof EmptyWidget);
            glb.widgets.splice(idx, 1);
        }
    
        this.prevTimePos = Math.min(this.prevTimePos, glb.widgets.length - 1);
        glb.timeline.max = `${glb.widgets.length - 1}`;
        this.updateTimePos(glb.timeline.valueAsNumber);
    }

    currentWidget() : Widget | undefined {
        if(glb.timeline.valueAsNumber != -1){
            return glb.widgets[glb.timeline.valueAsNumber];
        }
        else{
            return undefined;
        }
    }
    
    playWidgets(oncomplete:()=>void){
        function* fnc(ui: UI){
            let startPos = Math.max(0, glb.timeline.valueAsNumber);
    
            for(let pos = startPos; pos < glb.widgets.length; pos++){
                let act = glb.widgets[pos];
                yield* act.play();
                ui.updateTimePos(pos);
    
                if(ui.pauseFlag){
                    break;
                }
            }
    
            if(ui.pauseFlag){
    
                ui.pauseFlag = false;
            }
            else{
    
                if(oncomplete != undefined){
    
                    oncomplete();
                }
            }
        }
        
        runGenerator( fnc(this) );
    }

    addWidget(act: Widget){
        let selIdx = glb.timeline.valueAsNumber + 1;
    
        glb.widgets.splice(selIdx, 0, act);
    
        glb.timeline.max = `${glb.widgets.length - 1}`;
        this.updateTimePos(selIdx);
    
        this.textArea.focus();
    }

    setWidget(act: Widget){
        let selIdx = glb.timeline.valueAsNumber;

        console.assert(glb.widgets[selIdx] instanceof EmptyWidget);
        glb.widgets[selIdx] = act;
        this.summary.textContent = act.summary();
    }

    resetWidget(){
        let selIdx = glb.timeline.valueAsNumber;

        const act = glb.widgets[selIdx] as TextBlockWidget;
        if(act instanceof TextBlockWidget){

            glb.board.removeChild(act.div);
        }

        glb.widgets[selIdx] = new EmptyWidget();
        this.summary.textContent = glb.widgets[selIdx].summary();
    }

    addEmptyWidget(){
        this.addWidget(new EmptyWidget());
    }

    deleteWidget(){
        if(glb.timeline.valueAsNumber == -1){
            return;
        }

        let fnc = (act: Widget)=>{

            const refActs = glb.widgets.filter(x => x instanceof SelectionWidget && x.textAct == act) as SelectionWidget[];

            refActs.forEach(x => fnc(x));

            act.disable();
            if(act instanceof TextBlockWidget){

                glb.board.removeChild(act.div);
            }
        
            let idx = glb.widgets.indexOf(act);
            console.assert(idx != -1);
            glb.widgets.splice(idx, 1);
        }

        fnc(glb.widgets[glb.timeline.valueAsNumber]);

        let selIdx = glb.timeline.valueAsNumber;
        glb.timeline.max = `${glb.widgets.length - 1}`;

        if(selIdx < glb.widgets.length){
            glb.widgets[selIdx].enable();
        }

        this.updateTimePos( Math.min(selIdx, glb.widgets.length - 1) );
    }

    updateTimePos(pos: number){
        if(this.prevTimePos < pos){
            for(let i = this.prevTimePos + 1; i <= pos; i++){
                glb.widgets[i].enable();
            }
        }
        else if(pos < this.prevTimePos){
            for(let i = Math.min(this.prevTimePos, glb.widgets.length - 1); pos < i; i--){
                glb.widgets[i].disable();
            }
        }
    
        glb.board.scrollTop = glb.board.scrollHeight;
        window.scrollTo(0,document.body.scrollHeight);
    
        if(glb.timeline.valueAsNumber != pos){
    
            glb.timeline.valueAsNumber = pos;
        }
    
        this.prevTimePos = pos;
    
        let act = this.currentWidget();
        if(act instanceof SpeechWidget){
            
            let [caption, speech] = act.getCaptionSpeech();
            glb.caption.textContent = caption;
            reprocessMathJax(act, glb.caption, caption);
        }
        else{

            glb.caption.textContent = "";
        }

        if(act instanceof TextBlockWidget){

            this.lineFeedChk.parentElement!.style.display = "inline";
            this.lineFeedChk.checked = act.lineFeed;
        }
        else if(act instanceof SpeechWidget){

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

        if(glb.timeline.valueAsNumber != -1){

            const act = glb.widgets[glb.timeline.valueAsNumber];
            if(act instanceof TextWidget){

                this.textArea.value = act.text;

                if(act instanceof SpeechWidget){
                    this.textArea.style.backgroundColor = "ivory";
                }
            }

            this.summary.textContent = act.summary();
        }
    }

    updateFocusedTextBlock(){
        const text = this.textArea.value.trim();
        const act = this.currentWidget()!;

        if(act instanceof TextBlockWidget){

            const html = makeHtmlLines(text);
            act.div.innerHTML = html;
            act.text = text;

            reprocessMathJax(act, act.div, html);
        }

        this.summary.textContent = act.summary();
    }

    updateTextMath(){
        const act = this.currentWidget();
        if(act == undefined || act instanceof SpeechWidget){
            return;
        }
        
        let text = this.textArea.value.trim();

        if(act instanceof EmptyWidget){
            // 空のアクションの場合

            if(text != ""){

                if(glb.speechInput){

                    const newAct = new SpeechWidget(text);
                    this.setWidget(newAct);    
                }
                else{

                    const newAct = new TextBlockWidget(text);
                    
                    this.setWidget(newAct);
                    newAct.enable();
                }
            }
        }
        else if(act instanceof TextBlockWidget){

            if(text == ""){
                // テキストが削除された場合

                this.resetWidget();
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

            let act = this.currentWidget();

            this.updateTextMath();

            if(act instanceof SpeechWidget){
                runGenerator( act.play() );
            }

            this.addEmptyWidget();

            ev.stopPropagation();
            ev.preventDefault();
        }
    }

    textAreaBlur(ev: FocusEvent){
        msg("blur");
        this.updateTextMath();
    }

    writeTextFile(path: string, text: string){
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
    
    openDoc(path: string){
        fetchText(`json/${path}.json`, (text: string)=>{
            this.deserializeDoc(text);
        });
    }

    
    deserializeDoc(text: string){
        glb.widgets = [];
    
        glb.board.innerHTML = "";
    
        const doc = JSON.parse(text);

        this.txtTitle.value = doc.title;
    
        const h1 = document.createElement("h1");
        h1.innerHTML = doc.title;
        glb.board.appendChild(h1);
    
        for(let obj of doc.widgets){
            let act = parseObject(obj);
        
            glb.widgets.push(act);
        }

        let v = getAll();
        for(let x of v){
            if(x instanceof Shape && x.listeners.length != 0){
                x.listeners = parseObject(x.listeners);
            }
            if(x instanceof Point && x.bindTo != undefined){
                x.bindTo = parseObject(x.bindTo);
            }
        }
    
        this.summary.textContent = last(glb.widgets).summary();
    
        glb.timeline.max = `${glb.widgets.length - 1}`;
        glb.timeline.valueAsNumber = glb.widgets.length - 1;

        this.updateTimePos(-1);    
        this.onOpenDocComplete();
    }

}

export function parseObject(obj: any) : any {
    if(obj == undefined || obj == null || typeof obj != "object"){
        return obj;
    }

    if(Array.isArray(obj)){
        let v = obj.map(x => parseObject(x));
        return v;
    }

    if(obj.ref != undefined){
        let id = parseInt(obj.ref);
        let o = glb.refMap.get(id);
        console.assert(o != undefined);
        return o;
    }

    switch(obj.typeName){
    case TextBlockWidget.name:
        return new TextBlockWidget("").make(obj);

    case SpeechWidget.name:
        return new SpeechWidget("").make(obj);

    case View.name:
        return new View(obj);

    case Point.name:
        return new Point(obj);

    case Vec2.name:
        return new Vec2(obj.x, obj.y);

    case LineSegment.name:
        return new LineSegment().make(obj);

    case Rect.name:
        return new Rect().make(obj);

    default:
        console.assert(false);
        return null as any as Widget;
    }
}

export function bodyOnload(){
    console.log("body load");

    initSpeech();

    let ui = new UI();

    setEventListener(ui);
    setUIEditEventListener(ui);

    initDraw();
}

export function getData(){
    let path  = (document.getElementById("txt-path") as HTMLInputElement).value.trim();
    glb.ui.openDoc(path);
}

function getAll() : Widget[] {
    let v: Widget[] = [];

    glb.widgets.forEach(x => x.all(v));

    return v;
}

export function putData(){
    glb.widgets = glb.widgets.filter(x => ! (x instanceof EmptyWidget));

    let v = getAll();
    for(let [i, x] of v.entries()){
        x.id = i;
    }

    glb.widgetMap = [];
    let obj = {
        title: glb.ui.txtTitle.value.trim(),
        widgets : glb.widgets.map(x => x.toObj())
    }

    const text = JSON.stringify(obj, null, 4);

    let path  = (document.getElementById("txt-path") as HTMLInputElement).value.trim();

    glb.ui.writeTextFile(path, text);
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
}



let selAct: SelectionWidget | null = null;

export function onClickPointerMove(act:TextBlockWidget, ev: PointerEvent | MouseEvent, is_click: boolean){
    for(let ele = ev.srcElement as HTMLElement; ele; ele = ele.parentElement!){
        if([ "MJX-MI", "MJX-MN", "MJX-MO" ].includes(ele.tagName)){

            let v = Array.from(act.div.querySelectorAll('MJX-MI, MJX-MN, MJX-MO')) as HTMLElement[];
            let i = v.indexOf(ele);
            console.assert(i != -1);

            if(is_click){

                if(selAct == null){

                    let type = SelectionType.temporary;
                    if(ev.ctrlKey){
                        if(ev.shiftKey){
                            type = SelectionType.third;
                        }
                        else{
                            type = SelectionType.first;
                        }
                    }
                    else if(ev.shiftKey){
                        type = SelectionType.second;
                    }

                    selAct = new SelectionWidget(act, i, i + 1, type);
                    selAct.enable();

                    glb.ui.addWidget(selAct);
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

export function onPointerMove(act:TextBlockWidget, ev: PointerEvent){
    if(selAct == null){
        return;
    }
    onClickPointerMove(act, ev, false);
}

export function onClickBlock(act:TextBlockWidget, ev:MouseEvent){
    msg("clicked");
    ev.stopPropagation();
    onClickPointerMove(act, ev, true);
}

export function pauseWidget(ui: UI, fnc:()=>void){
    ui.pauseFlag = true;
    cancelSpeech();

    const id = setInterval(function(){
        if(! ui.pauseFlag && ! isSpeaking){

            clearInterval(id);
            msg("停止しました。");
            fnc();
        }
    },10);
}

}

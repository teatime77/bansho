namespace bansho {

export let glb: Glb;

export class Glb {
    widgets : Widget[] = [];
    allWidgets : Widget[] = [];
    widgetMap : Widget[] = [];
    refMap = new Map<number, Widget>();

    caption: HTMLHeadingElement;
    btnPlayPause: HTMLButtonElement;
    timeline : HTMLInputElement;
    board : HTMLDivElement;
    lineFeedChk : HTMLInputElement;
    textArea : HTMLTextAreaElement;
    txtFile : HTMLInputElement;
    selFile  : HTMLSelectElement;
    txtTitle: HTMLInputElement;
    summary : HTMLSpanElement;

    textSel: TextSelection | null = null;
    speechInput : boolean = false;

    isPlaying = false;
    pauseFlag : boolean;
    isSpeaking = false;

    prevTimePos : number;

    constructor(){
        this.caption  = document.getElementById("caption") as HTMLHeadingElement;
        this.timeline = document.getElementById("timeline") as HTMLInputElement;
        this.board    = document.getElementById("board") as HTMLDivElement;

        this.prevTimePos = -1;
        this.pauseFlag = false;

        this.btnPlayPause = document.getElementById("play-pause") as HTMLButtonElement;

        this.txtFile  = document.getElementById("txt-file") as HTMLInputElement;
        this.selFile  = document.getElementById("sel-file") as HTMLSelectElement;
        this.txtTitle = document.getElementById("txt-title") as HTMLInputElement;
        this.lineFeedChk = document.getElementById("line-feed") as HTMLInputElement;
        this.summary = document.getElementById("spn-summary") as HTMLSpanElement;
        this.textArea = document.getElementById("txt-math") as HTMLTextAreaElement;
    }
        
    showPlayButton = ()=>{
        this.btnPlayPause.disabled = false;
        this.btnPlayPause.innerHTML = "▶️";
    }

    clickPlayPause(){
        if(this.isPlaying){
    
            if(glb.isSpeaking){
                glb.pauseFlag = true;
                this.btnPlayPause.disabled = true;
                speechSynthesis.cancel();
            }
            else{

                this.showPlayButton();
            }
        }
        else{
    
            this.btnPlayPause.innerHTML = "⏸";
            this.playWidgets();
        }
        this.isPlaying = ! this.isPlaying;
    }

    onPlayComplete = ()=>{
        this.btnPlayPause.innerHTML = "▶️";
        this.isPlaying = false;
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
    
    playWidgets(){
        for(let pos = glb.timeline.valueAsNumber + 1; pos < glb.widgets.length; pos++){
            let act = glb.widgets[pos];
            act.enable();
            glb.updateTimePos(pos);

            if(act instanceof Speech){
                speak(act);
                return;
            }
        }
        
        glb.onPlayComplete();
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

        const act = glb.widgets[selIdx] as TextBlock;
        if(act instanceof TextBlock){

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

            const refActs = glb.widgets.filter(x => x instanceof TextSelection && x.textAct == act) as TextSelection[];

            refActs.forEach(x => fnc(x));

            act.disable();
            if(act instanceof TextBlock){

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
        if(act instanceof Speech){
            
            let [caption, speech] = act.getCaptionSpeech();
            glb.caption.textContent = caption;
            reprocessMathJax(act, glb.caption, caption);
        }
        else{

            glb.caption.textContent = "";
        }

        if(act instanceof TextBlock){

            this.lineFeedChk.parentElement!.style.display = "inline";
            this.lineFeedChk.checked = act.lineFeed;
        }
        else if(act instanceof Speech){

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

                if(act instanceof Speech){
                    this.textArea.style.backgroundColor = "ivory";
                }
            }

            this.summary.textContent = act.summary();
        }
    }

    updateFocusedTextBlock(){
        const text = this.textArea.value.trim();
        const act = this.currentWidget()!;

        if(act instanceof TextBlock){

            const html = makeHtmlLines(text);
            act.div.innerHTML = html;
            act.text = text;

            reprocessMathJax(act, act.div, html);
        }

        this.summary.textContent = act.summary();
    }

    updateTextMath(){
        const act = this.currentWidget();
        if(act == undefined){
            return;
        }
        
        let text = this.textArea.value.trim();

        if(act instanceof EmptyWidget){
            // 空のアクションの場合

            if(text != ""){

                if(glb.speechInput){

                    const newAct = new Speech(text);
                    this.setWidget(newAct);    
                }
                else{

                    const newAct = new TextBlock(text);
                    
                    this.setWidget(newAct);
                    newAct.enable();
                }
            }
        }
        else if(act instanceof TextWidget){

            if(text == ""){
                // テキストが削除された場合

                this.resetWidget();
            }
            else{
                // テキストがある場合

                let changed = (act.text != text);
                act.text = text;

                if(act instanceof TextBlock){

                    if(act.lineFeed != (act.div.getElementsByClassName("line-feed").length != 0)){

                        changed = true;
                    }

                    if(changed){
                        // テキストか改行が変更された場合

                        this.updateFocusedTextBlock();
                    }
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
            else if(! ev.shiftKey){
                glb.speechInput = ! glb.speechInput;
                if(glb.speechInput){
                    glb.textArea.style.backgroundColor = "ivory";
                }
                else{
    
                    glb.textArea.style.backgroundColor = "white";
                }
            }
        }
    }

    textAreaKeyPress(ev: KeyboardEvent){
        msg(`key press ${ev.ctrlKey} ${ev.key}`);
        if((ev.ctrlKey || ev.shiftKey) && ev.code == "Enter"){

            ev.stopPropagation();
            ev.preventDefault();

            let act = this.currentWidget();

            this.updateTextMath();

            if(act instanceof Speech){
                glb.pauseFlag = true;
                act.play();
            }

            this.addEmptyWidget();
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

        let v = Array.from( glb.refMap.values() );
        for(let x of v){
            if(x instanceof Shape && x.listeners.length != 0){
                x.listeners = parseObject(x.listeners);
            }
            if(x instanceof Point && x.bindTo != undefined){
                x.bindTo = parseObject(x.bindTo);
            }
        }

        for(let act of glb.widgets){
            if(act instanceof View){
                act.G0toG1();
            }
        }
    
        this.summary.textContent = last(glb.widgets).summary();
    
        glb.timeline.max = `${glb.widgets.length - 1}`;
        glb.timeline.valueAsNumber = glb.widgets.length - 1;

        this.updateTimePos(-1);    
        this.showPlayButton();
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

    if(obj.typeName == Vec2.name){
        return new Vec2(obj.x, obj.y);
    }

    console.assert(obj.id != undefined);
    console.assert(glb.refMap.get(parseInt(obj.id)) == undefined);

    switch(obj.typeName){
    case TextBlock.name:
        return new TextBlock("").make(obj);

    case Speech.name:
        return new Speech("").make(obj);

    case View.name:
        return new View(obj);

    case Point.name:
        return new Point(obj);

    case LineSegment.name:
        return new LineSegment().make(obj);

    case Rect.name:
        return new Rect().make(obj);

    case Circle.name:
        return new Circle(obj.byDiameter).make(obj);

    case DimensionLine.name:
        return new DimensionLine().make(obj);

    case Triangle.name:
        return new Triangle().make(obj);

    case TextBox.name:
        return new TextBox().make(obj);

    case Midpoint.name:
        return new Midpoint().make(obj);

    case Perpendicular.name:
        return new Perpendicular().make(obj);

    case ParallelLine.name:
        return new ParallelLine().make(obj);

    case Intersection.name:
        return new Intersection().make(obj);

    case Angle.name:
        return new Angle().make(obj);

    case Label.name:
        return new Label().make(obj);

    case Image.name:
        return new Image(obj);

    default:
        console.assert(false);
        return null as any as Widget;
    }
}

export function showFileList(obj: any){    
    for(let file of obj.files){
        let opt = document.createElement("option");
        opt.value = file;
        opt.textContent = file;
        glb.selFile.add(opt);
    }
}

export function bodyOnload(){
    console.log("body load");
    
    glb = new Glb();

    fetchFileList()    

    glb.updateSummaryTextArea();
    glb.addEmptyWidget();

    initSpeech();

    setEventListener();
    setUIEditEventListener();

    initDraw();
}

export function getData(){
    let path  = glb.selFile.value.trim();
    glb.openDoc(path);
}

export function getAll() : Widget[] {
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
        title: glb.txtTitle.value.trim(),
        widgets : glb.widgets.map(x => x.toObj())
    }

    const text = JSON.stringify(obj, null, 4);

    let path  = glb.txtFile.value.trim();

    glb.writeTextFile(path, text);
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

export function onClickPointerMove(act:TextBlock, ev: PointerEvent | MouseEvent, is_click: boolean){
    for(let ele = ev.srcElement as HTMLElement; ele; ele = ele.parentElement!){
        if([ "MJX-MI", "MJX-MN", "MJX-MO" ].includes(ele.tagName)){

            let v = Array.from(act.div.querySelectorAll('MJX-MI, MJX-MN, MJX-MO')) as HTMLElement[];
            let idx = v.indexOf(ele);
            console.assert(idx != -1);

            if(is_click){

                if(glb.textSel == null){

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

                    glb.textSel = new TextSelection(act, idx, idx + 1, type);
                    glb.textSel.enable();

                    glb.addWidget(glb.textSel);
                }
                else{
                    glb.textSel = null;
                }
            }
            else{
                
                glb.textSel!.endIdx = Math.max(idx, glb.textSel!.startIdx) + 1;
                glb.textSel!.moveBorder();
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

export function onPointerMove(act:TextBlock, ev: PointerEvent){
    if(glb.textSel == null){
        return;
    }
    onClickPointerMove(act, ev, false);
}

export function onClickBlock(act:TextBlock, ev:MouseEvent){
    msg("clicked");
    ev.stopPropagation();
    onClickPointerMove(act, ev, true);
}

}

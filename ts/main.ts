namespace bansho {

declare let MathJax:any;

export let glb: Glb;

export class Glb {
    widgets : Widget[] = [];
    widgetMap : Widget[] = [];
    refMap = new Map<number, Widget>();

    caption: HTMLHeadingElement;
    btnPlayPause: HTMLButtonElement;
    timeline : HTMLInputElement;
    selSummary : HTMLSelectElement;
    board : HTMLDivElement;
    lineFeedChk : HTMLInputElement;
    textArea : HTMLTextAreaElement;
    txtFile : HTMLInputElement;
    selFile  : HTMLSelectElement;
    txtTitle: HTMLInputElement;

    toolType = "";
    view: View | null = null;
    textSel: TextSelection | null = null;
    speechInput : boolean = false;

    isPlaying = false;
    pauseFlag = false;
    isSpeaking = false;

    prevTimePos : number = -1;

    eventPos!: Vec2;
    orgPos!: Vec2;

    constructor(){
        this.caption  = document.getElementById("caption") as HTMLHeadingElement;
        this.timeline = document.getElementById("timeline") as HTMLInputElement;
        this.selSummary    = document.getElementById("sel-summary") as HTMLSelectElement;
        this.board    = document.getElementById("board") as HTMLDivElement;

        this.btnPlayPause = document.getElementById("play-pause") as HTMLButtonElement;

        this.txtFile  = document.getElementById("txt-file") as HTMLInputElement;
        this.selFile  = document.getElementById("sel-file") as HTMLSelectElement;
        this.txtTitle = document.getElementById("txt-title") as HTMLInputElement;
        this.lineFeedChk = document.getElementById("line-feed") as HTMLInputElement;
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
        glb.timeline.max = `${glb.widgets.length - 1}`;
        this.updateTimePos(glb.timeline.valueAsNumber, false);
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
            glb.updateTimePos(pos, true);

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
        this.updateTimePos(selIdx, false);
    
        this.textArea.focus();
    }

    removeWidget(act: Widget){
        const idx = glb.widgets.indexOf(act);

        glb.widgets.splice(idx, 1);
        
        let opt = glb.selSummary.options[idx];
        removeHtmlElement(opt);
        act.delete();

        return idx;
    }

    deleteWidget(){
        if(glb.timeline.valueAsNumber == -1){
            return;
        }

        let act = glb.widgets[glb.timeline.valueAsNumber];

        if(act instanceof TextBlock){
            // TextBlockの場合

            // TextBlockの選択も削除する。
            glb.widgets
                .filter(x => x instanceof TextSelection && x.textAct == act)
                .forEach(x => glb.removeWidget(x));
        }
        else if(act instanceof Point || act instanceof LineSegment || act instanceof Angle){
            // 点, 線分, 角度の場合


            // 点, 線分, 角度の選択も削除する。
            let ref_acts = glb.widgets
                .filter(x => x instanceof ShapeSelection && x.shapes.includes(act as (Point|LineSegment|Angle))) as ShapeSelection[];

            for(let act2 of ref_acts){
                let i = act2.shapes.indexOf(act);
                console.assert(i != -1);
                act2.shapes.splice(i, 1);

                if(act2.shapes.length == 0){
                    glb.removeWidget(act2);
                }
            }
        }

        let act_idx = glb.removeWidget(act);

        glb.timeline.max = `${glb.widgets.length - 1}`;

        if(act_idx < glb.widgets.length){
            glb.widgets[act_idx].enable();
        }

        this.updateTimePos( Math.min(act_idx, glb.widgets.length - 1), false );
    }

    /**
     * ⏮, rngTimelineChange, playWidgets, addWidget, deleteWidget, deserializeDoc
     * @param pos 
     */
    updateTimePos(pos: number, playing: boolean){
        if(this.prevTimePos < pos){
            // 現在位置が右に動いた場合

            for(let i = this.prevTimePos + 1; i <= pos; i++){
                glb.widgets[i].enable();
            }
        }
        else if(pos < this.prevTimePos){
            // 現在位置が左に動いた場合

            for(let i = Math.min(this.prevTimePos, glb.widgets.length - 1); pos < i; i--){
                glb.widgets[i].disable();
            }

            if(pos != -1){
                glb.widgets[pos].enable();
            }
        }
    
        glb.board.scrollTop = glb.board.scrollHeight;
        window.scrollTo(0,document.body.scrollHeight);
    
        glb.timeline.valueAsNumber = pos;
        glb.prevTimePos            = pos;
        
        let act = this.currentWidget();
        if(act instanceof Speech){
            
            let [caption, speech] = act.getCaptionSpeech();
            glb.caption.textContent = caption;
            reprocessMathJax(act, glb.caption, caption);
        }
        else{

            glb.caption.textContent = "";
        }

        glb.setspeechInput(act instanceof Speech);

        this.lineFeedChk.parentElement!.style.display = (act instanceof TextBlock ? "inline" : "none");

        this.textArea.value = act instanceof TextWidget ? act.text : "";

        if(act instanceof TextWidget){

            if(act instanceof TextBlock){

                this.lineFeedChk.checked = act.lineFeed;
            }
            else if(act instanceof Speech){
                if(!playing){
                    deselectShape();
                }    
            }
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
    }

    updateTextMath(){
        const act = this.currentWidget();
        if(! (act instanceof TextWidget)){
            return;
        }
        
        let text = this.textArea.value.trim();
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

    setspeechInput(is_speech: boolean){
        glb.speechInput = is_speech;

        if(glb.speechInput){
            glb.textArea.style.borderColor = "blue";
        }
        else{
            glb.textArea.style.borderColor = "grey";
        }
    }

    textAreaKeyDown(ev: KeyboardEvent){
        msg(`key down ${ev.key}`);
        if(ev.key == "Insert"){
            if(ev.ctrlKey){

                this.textArea.value = "$$\n\\frac{1}{2 \\pi \\sigma^2} \\int_{-\\infty}^\\infty \\exp^{ - \\frac{{(x - \\mu)}^2}{2 \\sigma^2}  } dx\n$$";
            }
            else if(! ev.shiftKey){
                this.setspeechInput(! glb.speechInput)
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
                speak(act);
            }
        }
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
            this.initDoc(JSON.parse(text));
        });
    }

    
    initDoc(doc: any){
        glb.widgets = [];
        glb.refMap = new Map<number, Widget>();
        glb.timeline.max = "-1";
        glb.timeline.valueAsNumber = -1;
        glb.selSummary.innerHTML = "";
    
        glb.board.innerHTML = "";
    
        this.txtTitle.value = doc.title;
    
        const h1 = document.createElement("h1");
        h1.innerHTML = doc.title;
        glb.board.appendChild(h1);
    
        for(let obj of doc.widgets){
            if(obj.typeName == "TextBox"){
                msg(`SKIP Text-Box`);
                continue;
            }
            let act = parseObject(obj) as Widget;
        
            glb.widgets.push(act);

            // 要約のリストに表示する。
            let opt = document.createElement("option");
            opt.innerHTML = act.summary();
            glb.selSummary.add(opt);
        }

        MathJax.typesetPromise([glb.selSummary]);

        let v = Array.from( glb.refMap.values() );
        for(let x of v){
            if(x instanceof Shape && x.listeners.length != 0){
                x.listeners = parseObject(x.listeners);
                for(let shape of x.listeners){
                    if(!(shape instanceof Shape)){
                        msg(`ERR this:${x.id} ${x.summary()} shape:${(shape as any).id} ${(shape as any).summary()}`)
                    }
                }
        
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
        
        glb.timeline.max = `${glb.widgets.length - 1}`;
        glb.prevTimePos = glb.widgets.length - 1;

        this.updateTimePos(-1, false);
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

    switch(obj.typeName){
    case TextBlock.name:
        return new TextBlock("").make(obj);

    case Speech.name:
        return new Speech("").make(obj);

    case View.name:
        return new View().make(obj);

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

    case Image.name:
        return new Image(obj);

    case ShapeSelection.name:
        return new ShapeSelection().make(obj);

    case TextSelection.name:
        return new TextSelection().make(obj);

    default:
        console.assert(false);
        return null as any as Widget;
    }
}

export function showFileList(obj: any){    
    if(obj.files.length != 0){

        for(let file of obj.files){
            let opt = document.createElement("option");
            opt.value = file.name;
            opt.textContent = file.title;
            glb.selFile.add(opt);
        }

        glb.selFile.selectedIndex = 0;
        glb.txtFile.value = obj.files[0].name;
    }
}

export function bodyOnload(){
    console.log("body load");
    
    glb = new Glb();
    msg("$$ab$$ $$cd$$".replace(/\$\$/g, "\n\$\$\n"))

    fetchFileList();

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

                    let txtSel = new TextSelection();

                    txtSel.textAct  = act;
                    txtSel.startIdx = idx;
                    txtSel.endIdx   = idx + 1;
                    txtSel.type     = type;
                    
                    txtSel.enable();

                    glb.addWidget(txtSel);

                    glb.textSel = txtSel;
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

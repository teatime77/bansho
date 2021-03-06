namespace bansho {

declare let MathJax:any;

export let glb: Glb;

let workWidget : Widget | undefined = undefined;

export class Glb {
    static edit: boolean;
    static getJsonFile : boolean;
    static startPlayTime: number = 0;
    static msgBoxDlg: HTMLDialogElement;
    static msgBoxCB: ()=>void;

    docID   : number = NaN;
    widgets : Widget[] = [];
    widgetMap : Widget[] = [];
    refMap = new Map<number, Widget>();

    caption: HTMLHeadingElement;
    btnPlayPause: HTMLButtonElement;
    timeline : HTMLInputElement | null = null;
    playTime : HTMLSpanElement  | null = null;
    tblProperty : HTMLTableElement;
    selSummary : HTMLSelectElement;
    board : HTMLDivElement;
    textArea : HTMLTextAreaElement;
    btnDocId : HTMLButtonElement;
    txtTitle: HTMLInputElement;
    docScale : HTMLInputElement;
    youtube  : HTMLInputElement;

    toolType = "";
    view: View | null = null;
    textSel: TextSelection | null = null;

    isPlaying = false;
    pauseFlag = false;
    isSpeaking = false;

    prevTimePos : number = -1;

    eventPos!: Vec2;
    orgPos!: Vec2;

    constructor(){
        this.caption  = document.getElementById("caption") as HTMLHeadingElement;
        this.timeline = document.getElementById("timeline") as HTMLInputElement;
        this.playTime = document.getElementById("play-time") as HTMLSpanElement;
        this.tblProperty = document.getElementById("tbl-property") as HTMLTableElement;
        this.selSummary    = document.getElementById("sel-summary") as HTMLSelectElement;
        this.board    = document.getElementById("board") as HTMLDivElement;

        this.btnPlayPause = document.getElementById("play-pause") as HTMLButtonElement;

        this.btnDocId  = document.getElementById("txt-doc-id") as HTMLButtonElement;
        this.txtTitle = document.getElementById("txt-title") as HTMLInputElement;
        this.textArea = document.getElementById("txt-math") as HTMLTextAreaElement;
        this.docScale = document.getElementById("doc-scale") as HTMLInputElement;
        this.youtube  = document.getElementById("youtube") as HTMLInputElement;
        
        docsDlg = getElement("docs-dlg") as HTMLDialogElement;
        docsTbl = getElement("docs-tbl") as HTMLTableElement;    
    }
        
    showPlayButton = ()=>{
        this.btnPlayPause.disabled = false;
        this.btnPlayPause.innerHTML = "▶️";
    }

    clickPlayPause(){
        this.isPlaying = ! this.isPlaying;

        if(this.isPlaying){

            Glb.startPlayTime = (new Date()).getTime();
            this.btnPlayPause.innerHTML = "⏸";

            let sp = glb.widgets.slice(getTimelinePos() + 1).find(x => x instanceof Speech);
            if(sp instanceof Speech){

                let pos = glb.widgets.indexOf(sp);
                glb.updateTimePos(pos, true);
                sp.startSpeak(true);
            }
            else{

                glb.updateTimePos(glb.widgets.length - 1, true);
                glb.onPlayComplete();
            }
        }
        else{

            Glb.startPlayTime = 0;

            if(Speech.timer != null){
                clearTimeout(Speech.timer);
                Speech.timer = null;
            }
    
            if(glb.isSpeaking){
                glb.pauseFlag = true;
                this.btnPlayPause.disabled = true;
                speechSynthesis.cancel();
            }
            else{

                this.showPlayButton();
            }
        }
    }

    onPlayComplete = ()=>{
        this.btnPlayPause.innerHTML = "▶️";
        this.isPlaying = false;
    }

    rngTimelineChange(){   
        setTimePosMax( glb.widgets.length - 1 );
        this.updateTimePos(getTimelinePos());
    }

    currentWidget() : Widget | undefined {
        if(getTimelinePos() != -1){
            return glb.widgets[getTimelinePos()];
        }
        else{
            return undefined;
        }
    }

    addWidget(act: Widget){
        let selIdx = getTimelinePos();
    
        glb.widgets.splice(selIdx + 1, 0, act);

        // 要約を表示する。
        let opt = document.createElement("option");
        opt.innerHTML = act.summary();
        glb.selSummary.add(opt, 1 + selIdx + 1);
    
        setTimePosMax( glb.widgets.length - 1 );
        this.updateTimePos(selIdx + 1);
    
        this.textArea.focus();
    }

    removeWidget(act: Widget){
        const idx = glb.widgets.indexOf(act);

        glb.widgets.splice(idx, 1);
        
        let opt = glb.selSummary.options[idx + 1];
        removeHtmlElement(opt);

        act.delete();

        return idx;
    }

    deleteWidget(){
        let act = glb.currentWidget();
        if(act == undefined){
            return;
        }

        renumId();

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
                .filter(x => x instanceof WidgetSelection && x.selections.includes(act as (Point|LineSegment|Angle))) as WidgetSelection[];

            for(let act2 of ref_acts){
                let i = act2.selections.indexOf(act);
                console.assert(i != -1);
                act2.selections.splice(i, 1);

                if(act2.selections.length == 0){
                    glb.removeWidget(act2);
                }
            }
        }

        let act_idx = glb.removeWidget(act);

        setTimePosMax( glb.widgets.length - 1 );

        if(act_idx < glb.widgets.length){
            glb.widgets[act_idx].enable();
        }

        this.updateTimePos( Math.min(act_idx, glb.widgets.length - 1));
    }

    moveUpDown(up_down : number){
        let pos1 = getTimelinePos();
        let pos2 = pos1 + up_down;
        if(!(0 <= Math.min(pos1, pos2) && Math.max(pos1, pos2) < glb.widgets.length)){
            return;
        }

        let act = glb.widgets[pos1];
        glb.widgets[pos1] = glb.widgets[pos2];
        glb.widgets[pos2] = act;

        glb.selSummary.options[pos1+1].innerHTML = glb.widgets[pos1].summary();
        glb.selSummary.options[pos2+1].innerHTML = glb.widgets[pos2].summary();
        
        glb.updateTimePos(pos2);
    }
    
    /**
     * ⏮, rngTimelineChange, playWidgets, addWidget, deleteWidget, deserializeDoc
     * @param pos 
     */
    updateTimePos(pos: number, playing: boolean = false, setEnable: boolean = true){
        if(setEnable){

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
        }
    
        if(glb.timeline != null){
            glb.timeline.valueAsNumber = pos;
        }
    
        if(glb.selSummary != null){
            glb.selSummary.selectedIndex = pos + 1;
        }
    
        glb.prevTimePos = pos;
            
        let act = glb.currentWidget();
    
        if(act instanceof Speech){
            
            Speech.nextPos = 0;
            let [caption, speech] = act.splitCaptionSpeech(false);
            glb.caption.textContent = caption;
            reprocessMathJax(act, glb.caption, caption);
    
            if(!playing){
    
                deselectShape();
            }
        }
        else{
    
            glb.caption.textContent = "";
        }
    
        if(Glb.edit){
    
            if(act instanceof TextWidget){
    
                glb.textArea.style.backgroundColor = act instanceof Speech     ? "aliceblue"   : "whitesmoke";
                glb.textArea.value = act.Text;
                glb.textArea.disabled = false;
            }
            else{
    
                glb.textArea.style.backgroundColor = "white"
                glb.textArea.value = "";
                glb.textArea.disabled = true;
            }
    
            if(act != undefined){
                
                showProperty(act);
            }
        }

    }

    updateTextMath(){
        const act = this.currentWidget();
        if(! (act instanceof TextWidget)){
            return;
        }
        
        let text = this.textArea.value.trimRight();
        let changed = (act.Text != text);
        act.Text = text;

        if(act instanceof TextBlock){

            if(act.LineFeed != (act.div.getElementsByClassName("line-feed").length != 0)){

                changed = true;
            }
        }

        if(changed){
            // テキストか改行が変更された場合

            if(act instanceof TextBlock){

                const html = makeHtmlLines(text);
                act.div.innerHTML = html;
                act.Text = text;
    
                reprocessMathJax(act, act.div, html);
            }

            let i = glb.widgets.indexOf(act);
            glb.selSummary.options[1 + i].innerHTML = act.summary();
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
                act.startSpeak(true);
            }
        }
    }
    
    openDoc(doc_id: number){
        if(glb.btnDocId != null){

            glb.btnDocId.textContent = `${doc_id}`;
        }

        if(Glb.getJsonFile){

            fetchText(`json/${doc_id}.json`, (text: string)=>{
                glb.docID = doc_id;
                console.assert( ! isNaN(glb.docID) );
                let data = JSON.parse(text);
                this.initDoc(JSON.parse(data.text));
            });
        }
        else{

            fetchDB(`${doc_id}`, (id: string | null, data: any)=>{
                glb.docID = parseInt(id!);
                console.assert( ! isNaN(glb.docID) );
                this.initDoc(JSON.parse(data.text));
            });    
        }
        // fetchText(`json/${path}.json`, (text: string)=>{
        // });
    }
    
    initDoc(doc: any){
        // MathJaxのスケール
        if(doc.scale == undefined){

            doc.scale = 1.2;
        }
        if(glb.docScale != null){

            glb.docScale.value = `${doc.scale}`;
        }
        MathJax.startup.output.options.scale = doc.scale;

        if(glb.youtube != null){

            glb.youtube.value = doc.youtube != undefined ? doc.youtube : "";
        }

        doc.widgets = doc.widgets.filter((x : any) => x.typeName != "TextSelection");

        glb.widgets.forEach(x => x.delete());
        glb.widgets = [];
        glb.refMap = new Map<number, Widget>();
        setTimePosMax(-1);
        glb.updateTimePos(-1);

        if(Glb.edit){

            glb.selSummary.innerHTML = "<option>先頭</option>";
            glb.selSummary.selectedIndex = 0;
            glb.txtTitle.value = doc.title;
        }

        document.title = `${(doc.title as string).split('\n')[0]} - 板書`
    
        glb.board.removeChild(glb.caption);
        glb.board.innerHTML = "";
        glb.board.appendChild(glb.caption);
    
        // const h1 = document.createElement("h1");
        // h1.innerHTML = doc.title;
        // glb.board.insertBefore(h1, glb.caption);
    
        for(let obj of doc.widgets){
            if(obj.typeName == "TextBox"){
                msg(`SKIP Text-Box`);
                continue;
            }
            let act = parseObject(obj) as Widget;
        
            glb.widgets.push(act);

            // 要約のリストに表示する。
            if(Glb.edit){

                let opt = document.createElement("option");
                opt.innerHTML = act.summary();
                glb.selSummary.add(opt);
            }
        }

        if(Glb.edit){

            MathJax.typesetPromise([glb.selSummary]);
        }

        let v = Array.from( glb.refMap.values() );
        for(let x of v){
            if(x instanceof Shape && x.listeners.length != 0){
                x.listeners = parseObject(x.listeners);
                for(let shape of x.listeners){
                    if(!(shape instanceof Shape)){
                        msg(`ERR this:${x.id} ${x.summary()} shape:${shape}`)
                    }
                }
                // x.listeners = x.listeners.filter(x => x instanceof Shape);
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
        
        setTimePosMax( glb.widgets.length - 1 );
        glb.prevTimePos = glb.widgets.length - 1;

        this.updateTimePos(-1);
        this.showPlayButton();
    }

}

export function getTimelinePos(){
    if(glb.timeline != null){
        return glb.timeline.valueAsNumber;
    }
    else if(glb.selSummary != null){
        return glb.selSummary.selectedIndex - 1;
    }
    else{
        console.assert(false);
        return 0;
    }
}

export function setTimePosMax(pos: number){
    if(glb.timeline != null){
        glb.timeline.max = `${pos}`;
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

    case Simulation.name:
        return new Simulation().make(obj);

    case ViewPoint.name:
        return new ViewPoint().make(obj);
    
    case PackageInfo.name:
        return obj;

    case Variable.name:
        return new Variable(obj);
    
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

    case Arc.name:
        return new Arc().make(obj);

    case Angle.name:
        return new Angle().make(obj);

    case Image.name:
        return new Image(obj);

    case WidgetSelection.name:
    case "ShapeSelection":
            return new WidgetSelection().make(obj);

    case TextSelection.name:
        return new TextSelection().make(obj);

    case FuncLine.name:
        return new FuncLine().make(obj);

        case Surface.name:
            return new Surface().make(obj);
    
    default:
        console.assert(false);
        return null as any as Widget;
    }
}

function openDocFromUrl(){
    let id = getIdFromUrl();
    if(! isNaN(id)){

        glb.openDoc(id);
    }
}

export function getAll() : Widget[] {
    let v: Widget[] = [];

    glb.widgets.forEach(x => x.all(v));

    return v;
}

export function renumId(){
    let v = getAll();
    for(let [i, x] of v.entries()){
        x.id = i;
    }
}

export function putDoc(is_new: boolean){
    renumId();

    let title = glb.txtTitle.value.trim();
    glb.widgetMap = [];
    let obj = {
        scale : parseFloat(glb.docScale.value),
        title: title,
        widgets : glb.widgets.map(x => x.toObj())
    } as any;

    if(glb.youtube.value.startsWith("https://youtu.be/")){
        obj.youtube = glb.youtube.value.substring("https://youtu.be/".length).trim();
    }

    const text = JSON.stringify(obj, null, 4);

    putNewDoc(is_new, title, text, ()=>{
        alert(`保存しました。 ${title}`);
        getIndexFile(false);
    })
}

function getIdFromUrl(){
    let k = window.location.href.lastIndexOf('?');
    if(k == -1){
        return NaN;
    }

    let s = window.location.href.substring(k + 1);
    let v = s.split('=');
    if(v.length == 2 && v[0] == "id"){
        return parseInt(v[1]);
    }
    else{
        return NaN;
    }
}

export function initBansho(edit: boolean){
    Glb.edit     = edit;

    let href = window.location.href;

    Glb.getJsonFile = href.includes("://127.0.0.1:8080") || href.includes("://ban-sho.web.app/");
}

function getIndexFile(open_doc_from_url: boolean){
    if(Glb.getJsonFile){
        fetchText("json/index.json", (text: string)=>{
            indexFile = JSON.parse(text);
            setDocsTbl();

            if(open_doc_from_url){
                openDocFromUrl();
            }
        });
    }
    else{

        initFirebase(()=>{
            getElement("db-off").style.display = "none";

            setDocsTbl();

            if(open_doc_from_url){
                openDocFromUrl();
            }
        });
    }
}

export function initEdit(){
    console.log("body load");
    getMNIST();

    initBansho(true);
    Glb.edit     = true;

    
    glb = new Glb();

    initSpeech();

    setEventListener();

    setMsgBoxEventListener();
    
    initDraw();

    initBinder();

    console.log(`window.location.href : ${window.location.href}`);
    getIndexFile(true);
}

export function initPlay(){
    console.log("body load");

    initBansho(false);
    
    glb = new Glb();

    initSpeech();

    setEventListener();

    initDraw();

    let doc_id = getIdFromUrl();
    if(! isNaN(doc_id)){

        if(Glb.getJsonFile){
            fetchText("json/index.json", (text: string)=>{
                indexFile = JSON.parse(text);
                glb.openDoc(doc_id);
            });
        }
        else{
    
            initFirebase(()=>{
                glb.openDoc(doc_id);
            });
        }
    }
}

export function onClickPointerMove(act:TextBlock, ev: PointerEvent | MouseEvent, is_click: boolean){
    for(let ele = ev.target as HTMLElement; ele; ele = ele.parentElement!){
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

                    let act1 = glb.currentWidget() as WidgetSelection;
                    if(! (act1 instanceof WidgetSelection)){

                        act1 = new WidgetSelection();
                
                        glb.addWidget(act1);
                    }

                    act1.selections.push(txtSel);
                    act1.enable();

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


export function cutWidget(){
    if(workWidget != undefined){
        throw new Error();
    }

    workWidget = glb.currentWidget();
    if(!(workWidget instanceof Speech)){
        throw new Error();
    }

    glb.deleteWidget();
}

export function pasteWidget(){
    if(workWidget instanceof Speech){
        glb.addWidget(workWidget);
        workWidget = undefined;

        glb.selSummary.focus();
    }
    else{

        throw new Error();
    }


}


}

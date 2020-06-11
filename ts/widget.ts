namespace bansho {

export enum SelectionType {
    temporary,
    first,
    second,
    third
}

export class Widget{
    static count: number = 0;
    id: number;
    typeName: string;

    constructor(){
        this.id = Widget.count++;
        this.typeName = this.getTypeName();
    }

    make(obj: any) : Widget {
        if(obj.id != undefined){
            let id = parseInt(obj.id);
            glb.refMap.set(id, this);
        }
        for(let [k, v] of Object.entries(obj)){
            if(k == "listeners" || k == "bindTo"){
                (this as any)[k] = v;
            }
            else{

                (this as any)[k] = parseObject(v);
            }
        }

        return this;
    }

    all(v: Widget[]){
        if(! v.includes(this)){
            v.push(this);
        }
    }

    propertyNames() : string[] {
        return [];
    }

    getTypeName(){
        return this.constructor.name;
    }

    enable(){
    }

    disable(){
    }

    setEnable(enable: boolean){
        if(enable){
            this.enable();
        }
        else{
            this.disable();
        }
    }

    play() : any {
        this.enable();
    }

    summary() : string {
        return this.getTypeName();
    }

    makeObj() : any{
        return {
            id: this.id,
            typeName: this.typeName
        };
    }

    toObj(){
        if(glb.widgetMap.includes(this)){
            return { ref: this.id };
        }
        glb.widgetMap.push(this);

        return this.makeObj();
    }
}

export class EmptyWidget extends Widget {
    summary() : string {
        return "空";
    }
}

export class ShapeSelection extends Widget {
    shape: Point|LineSegment;

    constructor(shape: Point|LineSegment) {
        super();
        this.shape = shape;
    }

    makeObj() : any {
        return Object.assign(super.makeObj(), {
            shape: this.shape.toObj()
        });
    }

    enable(){
        this.shape.select(true);
    }

    disable(){
        this.shape.select(false);
    }
}

export class TextSelection extends Widget {
    textAct: TextBlock;
    startIdx: number = -1;
    endIdx: number = -1;
    type: number;
    border: HTMLDivElement | null = null;

    constructor(textAct: TextBlock, startIdx: number, endIdx: number, type: SelectionType){
        super();

        this.textAct  = textAct;
        this.startIdx = startIdx;
        this.endIdx   = endIdx;
        this.type    = type;
    }

    makeObj() : any {
        return Object.assign(super.makeObj(), {
            textAct: this.textAct.toObj(),
            startIdx: this.startIdx,
            endIdx: this.endIdx,
            type: this.type
        });
    }

    moveBorder(){
        let selectedDoms = this.setSelectedDoms();
        let rc0 = this.textAct.div.getBoundingClientRect();

        let minX = Number.MAX_VALUE, minY = Number.MAX_VALUE;
        let maxX = 0, maxY = 0;

        for(let dom of selectedDoms){
            let rc = dom.getBoundingClientRect();
            minX = Math.min(minX, rc.left);
            minY = Math.min(minY, rc.top);
            maxX = Math.max(maxX, rc.right);
            maxY = Math.max(maxY, rc.bottom);    
        }

        let bw = 2;

        let colors = [ "orange", "red", "blue", "green" ];

        let border = this.border;
        if(border == null){

            border = document.createElement("div");

            border.style.display = "none";
            border.style.position = "absolute";
            border.style.zIndex = "-1";
            border.style.margin = "0px";
            border.style.backgroundColor = "transparent";
            border.style.borderStyle = "solid";
    
            this.textAct.div.appendChild(border);
        }

        border.style.borderColor = colors[this.type];
        border.style.display = "inline-block";

        border.style.left   = `${minX - bw - rc0.left}px`;
        border.style.top    = `${minY - bw - rc0.top}px`;
        border.style.width  = `${maxX - minX + 2*bw}px`;
        border.style.height = `${maxY - minY + 2*bw}px`;
        border.style.borderWidth = `${bw}px`;

        this.border = border;
    }
    
    enable(){
        this.moveBorder();
        if(this.type == SelectionType.temporary){
            TemporarySelections.push(this);
        }
    }

    disable(){
        TemporarySelections = TemporarySelections.filter(x => x != this);

        let selectedDoms = this.setSelectedDoms();
        for(let dom of selectedDoms){
            dom.style.color = "unset";
            dom.style.backgroundColor = "unset";
        }    

        if(this.border != null){

            this.border.style.display = "none";
        }
    }

    summary() : string {
        return "選択";
    }

    setSelectedDoms() : HTMLElement[]{
        let v = Array.from(this.textAct.div.querySelectorAll('MJX-MI, MJX-MN, MJX-MO')) as HTMLElement[];

        return v.slice(this.startIdx, this.endIdx);
    }
}

export class TextWidget extends Widget {
    text: string;

    constructor(text: string){
        super();
        this.text = text;
    }

    make(obj: any) : Widget {
        console.assert(obj.text != undefined);
        this.text = obj.text;
    
        return this;
    }

    makeObj() : any {
        return Object.assign(super.makeObj(), {
            text: this.text
        });
    }

}

export class Speech extends TextWidget {

    constructor(text: string){
        super(text);
    }

    play(){
        this.enable();
        speak(this);
    }

    summary() : string {
        return "音声";
    }

    getCaptionSpeech(): [string, string]{
        let caption = "";
        let speech = "";
        let st = 0;
        while(st < this.text.length){
            let k1 = this.text.indexOf("'", st);
            if(k1 == -1){
                caption += this.text.substring(st);
                speech  += this.text.substring(st);
                break;
            }
    
            caption += this.text.substring(st, k1);
            speech  += this.text.substring(st, k1);
    
            k1++;
            let k2 = this.text.indexOf("'", k1);
            if(k2 == -1){
    
                caption += this.text.substring(st);
                speech  += this.text.substring(st);
                break;
            }
    
            let v = this.text.substring(k1, k2).split("|");
            if(v.length != 2){
    
                let s = this.text.substring(k1 - 1, k2 + 1)
                
                caption += s;
                speech  += s;
            }
            else{
    
                caption += v[0];
                speech  += v[1];
            }
    
            st = k2 + 1;
        }

        return[caption, speech];
    }
}

export class TextBlock extends TextWidget {
    div: HTMLDivElement;
    lineFeed: boolean = false;
    initialize = false;

    constructor(text: string){
        super(text);

        let nextEle = null;

        if(glb.timeline.valueAsNumber != -1){

            for(let act of glb.widgets.slice(glb.timeline.valueAsNumber + 1)){
                if(act instanceof TextBlock){
                    nextEle = act.div;
                    break;
                }
            }
        }
        
        this.div = document.createElement("div");
    
        this.div.id = getBlockId(this);
        this.div.style.position = "relative";
        this.div.style.display = "none";
    
        glb.board.insertBefore(this.div, nextEle);
    
        this.div.tabIndex = 0;
        
        setTextBlockEventListener(this);
    }

    make(obj: any) : Widget {
        super.make(obj);
        console.assert(obj.lineFeed != undefined);
        this.lineFeed = obj.lineFeed;

        return this;
    }

    enable(){
        this.div.style.display = "inline-block";
        if(! this.initialize){
            this.initialize = true;

            const html = makeHtmlLines(this.text);
            this.div.innerHTML = html;
            reprocessMathJax(this, this.div, html);
        }
    }

    disable(){
        this.div.style.display = "none";
    }

    makeObj() : any {
        return Object.assign(super.makeObj(), {
            lineFeed: this.lineFeed
        });
    }

    summary() : string {
        return "文字";
    }

    updateLineFeed(){
        if(this.div.nextSibling != null && this.div.nextSibling.nodeName == "BR"){
            // 次がBRの場合

            if(!this.lineFeed){
                // 改行しない場合

                this.div.parentNode!.removeChild(this.div.nextSibling);
            }
        }
        else{
            // 次がBRでない場合

            if(this.lineFeed){
                // 改行する場合

                let  br = document.createElement("br");
                br.className = "line-feed"
                this.div.parentNode!.insertBefore(br, this.div.nextSibling);
            }    
        }
    }
}

}
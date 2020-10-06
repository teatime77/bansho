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

    getValue(name: string){
        let value;

        let getter = (this as any)["get" + name] as Function;
        if(getter == undefined){
            value = (this as any)[name];
        }
        else{
            console.assert(getter.length == 0);
            value = getter.apply(this);
        }
        console.assert(value != undefined);

        return value;
    }

    getTypeName(){
        return this.constructor.name;
    }

    enable(){
        this.setEnable(true);
    }

    disable(){
        this.setEnable(false);
    }

    delete(){        
    }

    setEnable(enable: boolean){        
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

/*
    図形の選択
*/
export class ShapeSelection extends Widget {
    shapes: (Point|LineSegment|Angle)[] = [];

    makeObj() : any {
        return Object.assign(super.makeObj(), {
            shapes: this.shapes.map(x => x.toObj())
        });
    }

    setEnable(enable: boolean){
        for(let shape of this.shapes){
            shape.select(enable);
        }
    }
}

/*
    テキストの選択
*/
export class TextSelection extends Widget {
    textAct!: TextBlock;
    startIdx: number = -1;
    endIdx: number = -1;
    type!: number;
    border: HTMLDivElement | null = null;

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
    Text: string;

    constructor(text: string){
        super();
        this.Text = text;
    }

    makeObj() : any {
        return Object.assign(super.makeObj(), {
            Text: this.Text
        });
    }

}

export class TextBlock extends TextWidget {
    div: HTMLDivElement;
    LineFeed: boolean = false;
    initialize = false;

    constructor(text: string){
        super(text);

        let nextEle = glb.caption;

        if(getTimelinePos() != -1){

            for(let act of glb.widgets.slice(getTimelinePos() + 1)){
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

    propertyNames() : string[] {
        return [ "LineFeed" ];
    }

    setLineFeed(value: boolean){
        this.LineFeed = value;
        this.updateLineFeed();
    }

    enable(){
        this.div.style.display = "inline-block";
        if(! this.initialize){
            this.initialize = true;

            const html = makeHtmlLines(this.Text);
            this.div.innerHTML = html;
            reprocessMathJax(this, this.div, html);
        }
    }

    disable(){
        this.div.style.display = "none";
    }

    delete(){
        glb.board.removeChild(this.div);
    }

    makeObj() : any {
        return Object.assign(super.makeObj(), {
            LineFeed: this.LineFeed
        });
    }

    summary() : string {
        return `✏️\n${this.Text}`;
    }

    updateLineFeed(){
        if(this.div.nextSibling != null && this.div.nextSibling.nodeName == "BR"){
            // 次がBRの場合

            if(!this.LineFeed){
                // 改行しない場合

                this.div.parentNode!.removeChild(this.div.nextSibling);
            }
        }
        else{
            // 次がBRでない場合

            if(this.LineFeed){
                // 改行する場合

                let  br = document.createElement("br");
                br.className = "line-feed"
                this.div.parentNode!.insertBefore(br, this.div.nextSibling);
            }    
        }
    }
}

}
import { tostr, getBlockId, makeHtmlLines, colors, msg, idPrefix } from "./util";


export class Glb {
    widgets : Widget[] = [];
    caption: HTMLSpanElement;
    timeline : HTMLInputElement;
    board : HTMLDivElement;
    selectColor : number = 0;
    setTextBlockEventListener: ((act: TextBlockWidget)=>void) | undefined = undefined;

    constructor(){
        this.caption  = document.createElement("h3");
        this.caption.style.textAlign = "center";

        this.timeline = document.createElement("input");
        this.timeline.type = "range";
        this.timeline.min ="-1";
        this.timeline.max = "-1";
        this.timeline.value = "-1";
        this.timeline.step = "1";
        this.timeline.style.width = "100%";

        this.board    = document.createElement("div");
        this.board.style.overflow = "scroll";
        this.board.style.borderStyle = "inset";
        this.board.style.borderWidth = "3px";

    }
}

export let glb: Glb = new Glb();

export class Widget{
    typeName: string;
    id: number;

    constructor(){
        this.typeName = this.getTypeName();
        if(glb.widgets.length == 0){
            this.id = 0;
        }
        else{
            this.id = Math.max(... glb.widgets.map(x => x.id)) + 1;
        }
    }

    getTypeName(){
        return this.constructor.name;
    }

    toStr() : string {
        console.assert(false);
        return "";
    }

    enable(){
    }

    disable(){
    }

    *play() : any {
        this.enable();
        yield;
    }

    summary() : string {
        return this.getTypeName();
    }
}

export class EmptyWidget extends Widget {
    summary() : string {
        return "空";
    }
}

export class SelectionWidget extends Widget {
    refId: number;
    textAct: TextBlockWidget;
    domType: string;
    startIdx: number = -1;
    endIdx: number = -1;
    color: number;
    border: HTMLDivElement | null = null;

    constructor(refId: number, domType: string, startIdx: number, endIdx: number, color: number){
        super();
        this.refId   = refId;        

        this.textAct  = getWidgetById(refId) as TextBlockWidget;
        this.domType  = domType;
        this.startIdx = startIdx;
        this.endIdx   = endIdx;
        this.color    = color;
    }

    toStr() : string {
        return `{ "type": "select", "refId": ${this.refId}, "domType": "${this.domType}", "startIdx": ${this.startIdx}, "endIdx": ${this.endIdx}, "color": ${this.color} }`;
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

        this.border!.style.left   = `${minX - bw - rc0.left}px`;
        this.border!.style.top    = `${minY - bw - rc0.top}px`;
        this.border!.style.width  = `${maxX - minX + 2*bw}px`;
        this.border!.style.height = `${maxY - minY + 2*bw}px`;
        this.border!.style.borderWidth = `${bw}px`;
    }
    
    enable(){
        if(this.border == null){
            this.border = document.createElement("div");
            this.border.style.position = "absolute";
            this.border.style.zIndex = "-1";
            this.border.style.margin = "0px";
            this.border.style.backgroundColor = "transparent";
            this.border.style.borderStyle = "solid";
            this.textAct.div.appendChild(this.border);
        }
        this.moveBorder();
        this.border.style.borderColor = colors[this.color];
        this.border.style.display = "inline-block";
    }

    disable(){
        let selectedDoms = this.setSelectedDoms();
        for(let dom of selectedDoms){
            dom.style.color = "unset";
            dom.style.backgroundColor = "unset";
        }    

        this.border!.style.display = "none";
    }

    summary() : string {
        return "選択";
    }

    setSelectedDoms() : HTMLElement[]{
        console.assert(this.domType == "math");

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
}

export class TextBlockWidget extends TextWidget {
    div: HTMLDivElement;
    lineFeed: boolean = false;
    initialize = false;

    constructor(text: string){
        super(text);

        let nextEle = null;

        if(glb.timeline.valueAsNumber != -1){

            for(let act of glb.widgets.slice(glb.timeline.valueAsNumber + 1)){
                if(act instanceof TextBlockWidget){
                    nextEle = act.div;
                    break;
                }
            }
        }
        
        this.div = document.createElement("div");
    
        this.div.id = getBlockId(this.id);
        this.div.style.position = "relative";
        this.div.style.display = "none";
    
        glb.board.insertBefore(this.div, nextEle);
    
        this.div.tabIndex = 0;
        
        glb.setTextBlockEventListener!(this);
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

    toStr() : string {
        return `{ "type": "text", "text":${tostr(this.text)} }`;
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


function getWidgetById(id: number) : Widget {
    let act = glb.widgets.find(x => x.id == id);
    console.assert(act != undefined);

    return act!;
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


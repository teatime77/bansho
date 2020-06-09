namespace bansho{

const infinity = 20;
const strokeWidth = 4;
const thisStrokeWidth = 2;
const angleStrokeWidth = 2;
const gridLineWidth = 1;

declare let MathJax:any;
let tblProperty : HTMLTableElement;
let view : View;

export let focusedActionIdx : number;

export let textMath : HTMLTextAreaElement;

const defaultUid = "Rb6xnDguG5Z9Jij6XLIPHV4oNge2";
let loginUid : string | null = null;
let guestUid = defaultUid;
let firebase: any;

function getImgRef(fileName: string, mode:string){
    // Create a root reference
    const storageRef = firebase.storage().ref();

    let uid: string;
    switch(mode){
    case "r": uid = guestUid; break;
    case "w":
        if(loginUid == null){

            console.assert(false);
        }
        else{

            uid = loginUid; 
            break;
        }
        default: console.assert(false); return;
    }

    return storageRef.child(`/users/${uid}/img/${fileName}`);
}

export function setSvgImg(img: SVGImageElement, fileName: string){
    const imgRef = getImgRef(fileName, "r");

    imgRef.getDownloadURL().then(function(downloadURL: string) {
        bansho.msg(`download URL: [${downloadURL}]`);
        
        img.setAttributeNS('http://www.w3.org/1999/xlink','href',downloadURL);
    });
}

export function arrayLast<T>(arr:T[]) : T{
    console.assert(arr.length != 0);
    return arr[arr.length - 1];
}

function toSvgRatio() : Vec2 {
    const rc1 = view.svg.getBoundingClientRect() as DOMRect;
    const rc2 = view.div.getBoundingClientRect() as DOMRect;

    console.assert(rc1.x == rc2.x && rc1.y == rc2.y && rc1.width == rc2.width && rc1.height == rc2.height);

    return new Vec2(view.svg.viewBox.baseVal.width / rc1.width, view.svg.viewBox.baseVal.height / rc1.height) ;
}


export function getSvgPoint(ev: MouseEvent | PointerEvent, draggedPoint: Point|null){

    const p = view.DomToSvgPos(ev.offsetX, ev.offsetY);

    if(view.SnapToGrid){

        const ele = document.elementFromPoint(ev.clientX, ev.clientY);
        if(ele == view.svg || ele == view.gridBg || (draggedPoint != null && ele == draggedPoint.circle)){
            p.x = Math.round(p.x / view.GridWidth ) * view.GridWidth;
            p.y = Math.round(p.y / view.GridHeight) * view.GridHeight;
        }
    }

    return new Vec2(p.x, p.y);
}

function clickHandle(ev: MouseEvent, pt:Vec2) : Point{
    let handle = getPoint(ev);
    if(handle == null){

        const line = getLine(ev);
        if(line != null){

            handle = new Point({pos:pt});
            line.adjust(handle);

            line.bind(handle)
        }
        else{
            const circle = getCircle(ev);
            if(circle != null){

                handle = new Point({pos:pt});
                circle.adjust(handle);

                circle.bind(handle)
            }
            else{

                handle = new Point({pos:pt});
            }
        }
    }
    else{
        handle.select(true);
    }

    return handle;
}

function getPoint(ev: MouseEvent) : Point | null{
    const pt = view.shapes.find(x => x.constructor.name == "Point" && (x as Point).circle == ev.target) as (Point|undefined);
    return pt == undefined ? null : pt;
}

function getLine(ev: MouseEvent) : LineSegment | null{
    const line = view.shapes.find(x => x instanceof LineSegment && (x as LineSegment).line == ev.target && (x as LineSegment).handles.length == 2) as (LineSegment|undefined);
    return line == undefined ? null : line;
}

function getCircle(ev: MouseEvent) : Circle | null{
    const circle = view.shapes.find(x => x.constructor.name == "Circle" && (x as Circle).circle == ev.target && (x as Circle).handles.length == 2) as (Circle|undefined);
    return circle == undefined ? null : circle;
}

function linesIntersection(l1:LineSegment, l2:LineSegment) : Vec2 {
    l1.setVecs();
    l2.setVecs();

    /*
    l1.p1 + u l1.p12 = l2.p1 + v l2.p12

    l1.p1.x + u l1.p12.x = l2.p1.x + v l2.p12.x
    l1.p1.y + u l1.p12.y = l2.p1.y + v l2.p12.y

    l1.p12.x, - l2.p12.x   u = l2.p1.x - l1.p1.x
    l1.p12.y, - l2.p12.y   v = l2.p1.y - l1.p1.y
    
    */
    const m = new Mat2(l1.p12.x, - l2.p12.x, l1.p12.y, - l2.p12.y);
    const v = new Vec2(l2.p1.x - l1.p1.x, l2.p1.y - l1.p1.y);
    const mi = m.inv();
    const uv = mi.dot(v);
    const u = uv.x;

    return l1.p1.add(l1.p12.mul(u));
}

function calcFootOfPerpendicular(pos:Vec2, line: LineSegment) : Vec2 {
    const p1 = line.handles[0].pos;
    const p2 = line.handles[1].pos;

    const e = p2.sub(p1).unit();
    const v = pos.sub(p1);
    const h = e.dot(v);

    const foot = p1.add(e.mul(h));

    return foot;
}


export function setToolType(){
    const textBoxes = glb.widgets.filter(x => x instanceof TextBox) as TextBox[];

    view.toolType = (document.querySelector('input[name="tool-type"]:checked') as HTMLInputElement).value;

    if(view.toolType == "TextSelection"){

        textBoxes.forEach(x => x.div.style.zIndex = "auto");
    }
    else{

        // textBoxes.forEach(x => x.div.style.zIndex = "-1");
    }
    if(view.toolType == "select"){

        textBoxes.forEach(x => x.div.style.cursor = "move");
    }
    else if(view.toolType == "TextSelection"){

        textBoxes.forEach(x => x.div.style.cursor = "text");
    }
    else{

        textBoxes.forEach(x => x.div.style.cursor = "default");
    }
}

function makeToolByType(toolType: string): Shape|undefined {
    const v = toolType.split('.');
    const typeName = v[0];
    const arg = v.length == 2 ? v[1] : null;

    switch(typeName){
        case "Point":         return new Point({pos:new Vec2(0,0)});
        case "LineSegment":   return new LineSegment();
        case "BSpline":       return new BSpline();
        case "Rect":          return new Rect().make({isSquare:(arg == "2")}) as Shape;
        case "Circle":        return new Circle(arg == "2");
        case "DimensionLine": return new DimensionLine();
        case "Triangle":      return new Triangle();
        case "Midpoint":      return new Midpoint();
        case "Perpendicular": return new Perpendicular()
        case "ParallelLine":  return new ParallelLine()
        case "Intersection":  return new Intersection();
        case "Angle":         return new Angle();
        case "TextBox":       return new TextBox().make({ Text: "$\\int_{-\\infty}^\\infty$" });
        case "Label":         return new Label().make({Text:"こんにちは"}) as Shape;
        case "Image":         return new Image({fileName:"./img/teatime77.png"});
    } 
}

function showProperty(act: Widget){
    tblProperty.innerHTML = "";

    for(let name of act.propertyNames()){

        const tr = document.createElement("tr");

        const nameTd = document.createElement("td");
        nameTd.innerText = name;

        const valueTd = document.createElement("td");

        let value;

        let getter = (act as any)["get" + name] as Function;
        if(getter == undefined){
            value = (act as any)[name];
        }
        else{
            console.assert(getter.length == 0);
            value = getter.apply(act);
        }
        console.assert(value != undefined);
        
        const setter = (act as any)["set" + name] as Function;
        console.assert(setter.length == 1);

        if(act instanceof Angle && name == "Mark"){
            const sel = document.createElement("select");
            for(let s of [ "□", ")", "))", ")))", "/", "//", "///" ]){
                let opt = document.createElement("option");
                opt.textContent = s;
                sel.add(opt);
            }
            valueTd.appendChild(sel);
            sel.selectedIndex = act.Mark;

            setPropertySelectEventListener(act, sel, setter);
        }
        else{

            const inp = document.createElement("input");
            inp.style.width = "100%";

            switch(typeof value){
            case "string":
            case "number":
                inp.type = "text";
                inp.value = `${value}`;
                setPropertyTextEventListener(act, inp, setter);
                break;
            case "boolean":
                inp.type = "checkbox";
                inp.checked = value as boolean;
                setPropertyCheckboxEventListener(act, inp, setter);
                break;
            }
            valueTd.appendChild(inp);
        }        

        tr.appendChild(nameTd);
        tr.appendChild(valueTd);

        tblProperty.appendChild(tr);
    }
}


export function svgClick(ev: MouseEvent){
    if(view.capture != null || view.toolType == "TextSelection"){
        return;
    }

    if(ev.ctrlKey || view.toolType == "select"){

        // for(let ele = ev.srcElement; obj; obj = ob)
        let clicked_shape : Shape|null = null;
        for(let shape of view.shapes.values()){
            if(shape instanceof TextBox && shape.handles[0].circle == ev.srcElement){
                clicked_shape = shape;
                break;
            }
            if(Object.values(shape).includes(ev.srcElement)){
                clicked_shape = shape;
                break;
            }
            if(shape instanceof Angle && (shape.arcs as any[]).concat(shape.primes).includes(ev.srcElement as any)){
                clicked_shape = shape;
                break;
            }
        }

        if(ev.ctrlKey){
            if(clicked_shape instanceof Point || clicked_shape instanceof LineSegment){

                const selAct = new ShapeSelection(clicked_shape);
                selAct.enable();
        
                glb.ui.addWidget(selAct);
            }
        }
        else{
            
            if(clicked_shape == null){
                showProperty(view);
            }
            else{
                showProperty(clicked_shape);
            }    
        }
        
        return;
    }

    const pt = getSvgPoint(ev, null);

    if(view.tool == null){
        view.tool = makeToolByType(view.toolType)!;
        console.assert(view.tool.getTypeName() == view.toolType.split('.')[0]);
    }

    if(view.tool != null){

        view.tool.click(ev, pt);
    }
}

export function svgPointermove(ev: PointerEvent){
    if(view.capture != null){
        return;
    }

    if(view.tool != null){
        view.tool.pointermove(ev);
    }
}

export function addShape(){
    const view1 = new View({ Width: 500, Height: 500, ViewBox: "-5 -15 20 20" });
    glb.widgets.push(view1);
}

export function initDraw(){
    tblProperty = document.getElementById("tbl-property") as HTMLTableElement;
    setToolTypeEventListener();
}

export class Vec2 {
    typeName: string = "Vec2";
    x: number;
    y: number;

    constructor(x:number, y: number){
        this.x = x;
        this.y = y;
    }

    equals(pt: Vec2): boolean {
        return this.x == pt.x && this.y == pt.y;
    }

    add(pt: Vec2) : Vec2{
        return new Vec2(this.x + pt.x, this.y + pt.y);
    }

    sub(pt: Vec2) : Vec2{
        return new Vec2(this.x - pt.x, this.y - pt.y);
    }

    mul(c: number) : Vec2 {
        return new Vec2(c * this.x, c * this.y);
    }

    len2(): number {
        return this.x * this.x + this.y * this.y;
    }

    len(): number {
        return Math.sqrt(this.len2());
    }

    dist(pt:Vec2) : number {
        const dx = pt.x - this.x;
        const dy = pt.y - this.y;

        return Math.sqrt(dx * dx + dy * dy);
    }

    dot(pt:Vec2) : number{
        return this.x * pt.x + this.y * pt.y;
    }

    unit() : Vec2{
        const d = this.len();

        if(d == 0){

            return new Vec2(0, 0);
        }

        return new Vec2(this.x / d, this.y / d);
    }

    divide(t: number, pt: Vec2) : Vec2 {
        const x = (1 - t) * this.x + t * pt.x;
        const y = (1 - t) * this.y + t * pt.y;

        return new Vec2(x, y);
    }
}

export class Mat2 {
    a11 : number;
    a12 : number;
    a21 : number;
    a22 : number;

    constructor(a11:number, a12:number, a21:number, a22:number){
        this.a11 = a11;
        this.a12 = a12;
        this.a21 = a21;
        this.a22 = a22;
    }

    print(){
        bansho.msg(`${this.a11} ${this.a12}\n${this.a21} ${this.a22}`);
    }

    det(){
        return this.a11 * this.a22 - this.a12 * this.a21;
    }

    mul(m:Mat2):Mat2 {
        return new Mat2(this.a11 * m.a11 + this.a12 * m.a21, this.a11 * m.a12 + this.a12 * m.a22, this.a21 * m.a11 + this.a22 * m.a21, this.a21 * m.a12 + this.a22 * m.a22);
    }

    dot(v:Vec2) : Vec2{
        return new Vec2(this.a11 * v.x + this.a12 * v.y, this.a21 * v.x + this.a22 * v.y);
    }

    inv() : Mat2 {
        const det = this.det();
        console.assert(det != 0);

        return new Mat2(this.a22 / det, - this.a12 / det, - this.a21 / det, this.a11 / det)
    }
}

export class ShapeEvent{
    destination: Shape;
    sources: Shape[];

    constructor(destination: Shape, sources: Shape[]){
        this.destination = destination;
        this.sources = sources;
    }
}

export class EventQueue {
    events : ShapeEvent[] = [];

    addEvent(destination:Shape, source: Shape){
        // 送付先が同じイベントを探す。
        const event = this.events.find(x=>x.destination == destination);

        if(event == undefined){
            // 送付先が同じイベントがない場合

            // イベントを追加する。
            this.events.push( new ShapeEvent(destination, [source]) );
        }
        else{
            // 送付先が同じイベントがある場合

            if(!event.sources.includes(source)){
                // 送付元に含まれない場合

                // 送付元に追加する。
                event.sources.push(source);
            }
        }
    }

    addEventMakeEventGraph(destination:Shape, source: Shape){
        this.addEvent(destination, source);
        destination.makeEventGraph(source);
    }

    processQueue =()=>{
        const processed : Shape[] = [];

        while(this.events.length != 0){
            // 先頭のイベントを取り出す。
            let event = this.events[0];

            if(! processed.includes(event.destination)){
                // 処理済みでない場合

                processed.push(event.destination);

                // イベント処理をする。
                event.destination.processEvent(event.sources);
            }

            // 先頭のイベントを除去する。
            this.events.shift();
        }
    }
}

export class ShapeWidget extends Widget {
    constructor(){
        super();
    }

    getTypeName(){
        return this.constructor.name;
    }

    enable(){
    }

    disable(){
    }

    summary() : string {
        return this.getTypeName();
    }
}


export class View extends ShapeWidget {
    div : HTMLDivElement;
    svg : SVGSVGElement;
    defs : SVGDefsElement;
    gridBg : SVGRectElement;
    G0 : SVGGElement;
    G1 : SVGGElement;
    G2 : SVGGElement;
    CTMInv : DOMMatrix | null = null;
    svgRatio: number;
    shapes: Shape[]= [];
    toolType = "";
    tool : Shape | null = null;
    eventQueue : EventQueue = new EventQueue();
    capture: Point|null = null;
    ShowGrid : boolean = false;
    GridWidth : number = 1;
    GridHeight : number = 1;
    SnapToGrid: boolean = false;
    FlipY : boolean = true;

    Width      : number = 0;
    Height     : number = 0;
    ViewBox    : string = "";
    ShowXAxis  : boolean = true;
    ShowYAxis  : boolean = true;

    xyAxis : (LineSegment|null)[] = [ null, null];

    constructor(obj: any = {}){
        super();

        console.assert(obj.Width != undefined && obj.Height != undefined && obj.ViewBox != undefined);
        super.make(obj);
        view = this;

        this.div = document.createElement("div");

        this.div.style.width  = `${this.Width}px`;
        this.div.style.height = `${this.Height}px`;
        this.div.style.position = "relative";
        this.div.style.padding = "0px";
        this.div.style.zIndex = "1";
        this.div.style.backgroundColor = "cornsilk";

        this.svg = document.createElementNS("http://www.w3.org/2000/svg","svg") as SVGSVGElement;

        this.svg.style.width  = `${this.Width}px`;
        this.svg.style.height = `${this.Height}px`;
        this.svg.style.margin = "0px";

        // viewBox="-10 -10 20 20"
        this.svg.setAttribute("viewBox", this.ViewBox);

        this.svg.setAttribute("preserveAspectRatio", "none");
        //---------- 
        glb.board.appendChild(this.div);
        this.div.appendChild(this.svg);

        this.setCTMInv();
    
        const rc = this.svg.getBoundingClientRect() as DOMRect;
        this.svgRatio = this.svg.viewBox.baseVal.width / rc.width;
    
        this.defs = document.createElementNS("http://www.w3.org/2000/svg","defs") as SVGDefsElement;
        this.svg.appendChild(this.defs);

        // グリッドの背景の矩形
        this.gridBg = document.createElementNS("http://www.w3.org/2000/svg","rect");
        this.svg.appendChild(this.gridBg);

        this.G0 = document.createElementNS("http://www.w3.org/2000/svg","g");
        this.G1 = document.createElementNS("http://www.w3.org/2000/svg","g");
        this.G2 = document.createElementNS("http://www.w3.org/2000/svg","g");
    
        if(this.FlipY){
            
            const transform = this.getTransform();
            this.G0.setAttribute("transform", transform);
            this.G1.setAttribute("transform", transform);
            this.G2.setAttribute("transform", transform);
        }
    
        this.svg.appendChild(this.G0);
        this.svg.appendChild(this.G1);
        this.svg.appendChild(this.G2);

        this.setShowXAxis(this.ShowXAxis);
        this.setShowYAxis(this.ShowYAxis);
    
        setViewEventListener(this);

        setToolType();

        return this;
    }

    getTransform(){
        const f = 2 * this.svg.viewBox.baseVal.y + this.svg.viewBox.baseVal.height;
        return `matrix(1, 0, 0, -1, 0, ${f})`;
    }

    propertyNames() : string[] {
        return [ "Width", "Height", "ViewBox", "ShowGrid", "GridWidth", "GridHeight", "SnapToGrid", "FlipY", "ShowXAxis", "ShowYAxis" ];
    }

    makeObj() : any {
        return Object.assign(super.makeObj(), {
            "Width"   : this.Width,
            "Height"  : this.Height,
            "ViewBox" : this.svg.getAttribute("viewBox"),
            "FlipY"   : this.FlipY,
            "ShowXAxis": this.ShowXAxis,
            "ShowYAxis": this.ShowYAxis,
        });
    }

    summary() : string {
        return "view";
    }

    setCTMInv(){
        const CTM = this.svg.getCTM()!;
        if(CTM != null){

            this.CTMInv = CTM.inverse();
        }
    }

    setWidth(value: number){
        this.Width = value;

        this.div.style.width = `${this.Width}px`;
        this.svg.style.width = `${this.Width}px`;

        this.setCTMInv();
    }

    setHeight(value: number){
        this.Height = value;

        this.div.style.height = `${this.Height}px`;
        this.svg.style.height = `${this.Height}px`;

        this.setCTMInv();
    }

    setViewBox(value: string){
        this.ViewBox = value;

        this.svg.setAttribute("viewBox", this.ViewBox);

        this.setCTMInv();

        this.setGridBgBox();
    }

    setShowGrid(value: boolean){
        if(this.ShowGrid == value){
            return;
        }

        this.ShowGrid = value;

        if(this.ShowGrid){
            this.setGridBgBox();
            this.setGridPattern();
        }
        else{

        this.gridBg.setAttribute("fill", "transparent");
        }
    }

    setGridWidth(value: any){
        this.GridWidth = parseFloat(value);

        this.setGridPattern();
    }

    setGridHeight(value: any){
        this.GridHeight = parseFloat(value);

        this.setGridPattern();
    }

    setSnapToGrid(value: boolean){
        this.SnapToGrid = value;
    }

    setFlipY(value: boolean){
        this.FlipY = value;
    }

    setShowXAxis(value: boolean){
        this.ShowXAxis = value;
        this.setShowXYAxis(value, 0);
    }

    setShowYAxis(value: boolean){
        this.ShowYAxis = value;
        this.setShowXYAxis(value, 1);
    }

    setShowXYAxis(show_axis: boolean, idx: number){
        const big_value = Math.max(this.svg.viewBox.baseVal.width, this.svg.viewBox.baseVal.height) * 10000;

        if(show_axis != (this.xyAxis[idx] != null)){
            if(show_axis){
                if(idx == 0){

                    this.xyAxis[idx] = new LineSegment().makeByPos(-big_value, 0, big_value, 0);
                }
                else{

                    this.xyAxis[idx] = new LineSegment().makeByPos(0, -big_value, 0, big_value);
                }
            }
            else{
                this.xyAxis[idx]!.delete();
                this.xyAxis[idx] = null;
            }
        }
    }

    makeLine(x1: number, y1: number, x2: number, y2: number){
        const line = document.createElementNS("http://www.w3.org/2000/svg","line");
        line.setAttribute("stroke", "navy");
        line.setAttribute("stroke-width", `${this.toSvg2(strokeWidth)}`);
        line.setAttribute("x1", `${x1}`);
        line.setAttribute("y1", `${y1}`);
        line.setAttribute("x2", `${x2}`);
        line.setAttribute("y2", `${y2}`);

        this.G1.insertBefore(line, this.G1.firstElementChild);

        return line;
    }

    setGridBgBox(){
        // viewBoxを得る。
        const vb = this.svg.viewBox.baseVal;

        // グリッドの背景の矩形をviewBoxに合わせる。
        this.gridBg.setAttribute("x", `${vb.x}`);
        this.gridBg.setAttribute("y", `${vb.y}`);
        this.gridBg.setAttribute("width", `${vb.width}`);
        this.gridBg.setAttribute("height", `${vb.height}`);
    }

    setGridPattern(){
        // 現在のパターンを削除する。
        while(this.defs.childNodes.length != 0){
            if(this.defs.firstChild == null){

                console.assert(false);
            }
            else{

                this.defs.removeChild(this.defs.firstChild);
            }
        }

        // viewBoxを得る。
        const vb = this.svg.viewBox.baseVal;

        const patternId = `pattern-${this.id}`;

        const pattern = document.createElementNS("http://www.w3.org/2000/svg","pattern") as SVGPatternElement;
        pattern.setAttribute("id", patternId);
        pattern.setAttribute("patternUnits", "userSpaceOnUse");
        pattern.setAttribute("x", `${vb.x}`);
        pattern.setAttribute("y", `${vb.y}`);
        pattern.setAttribute("width", `${this.GridWidth}`);
        pattern.setAttribute("height", `${this.GridHeight}`);
    
        this.defs.appendChild(pattern);

        const rect = document.createElementNS("http://www.w3.org/2000/svg","rect");
        rect.setAttribute("x", "0");
        rect.setAttribute("y", "0");
        rect.setAttribute("width", `${this.GridWidth}`);
        rect.setAttribute("height", `${this.GridHeight}`);
        rect.setAttribute("fill", "transparent");
        rect.setAttribute("stroke", "black");
        rect.setAttribute("stroke-width", `${this.toSvg2(gridLineWidth)}`);
    
        pattern.appendChild(rect);
    
        this.gridBg.setAttribute("fill", `url(#${patternId})`);
    }

    DomToSvgPos(x1: number, y1: number) : Vec2 {
        const rc1 = this.svg.getBoundingClientRect() as DOMRect;
        const rc2 = this.div.getBoundingClientRect() as DOMRect;
    
        console.assert(rc1.x == rc2.x && rc1.y == rc2.y && rc1.width == rc2.width && rc1.height == rc2.height);
    
        if(this.FlipY){
    
            y1 = rc2.height - y1;
        }

        const x = this.svg.viewBox.baseVal.x + this.svg.viewBox.baseVal.width  * x1 / rc1.width;
        const y = this.svg.viewBox.baseVal.y + this.svg.viewBox.baseVal.height * y1 / rc1.height;
    
        let p2 = new Vec2(x, y);

        if(this.CTMInv != null){

            const point = this.svg.createSVGPoint();

            //画面上の座標を取得する．
            point.x = x1;
            point.y = y1;

            //座標に逆行列を適用する．
            const p3 = point.matrixTransform(this.CTMInv);

            // console.assert(Math.abs(p2.x - p3.x) < 0.01 && Math.abs(p2.y - p3.y) < 0.01)
        }
            
        return p2;
    }
    
    SvgToDomPos(pt: Vec2) : Vec2 {
        const rc1 = this.svg.getBoundingClientRect() as DOMRect;
        const rc2 = this.div.getBoundingClientRect() as DOMRect;

        console.assert(rc1.x == rc2.x && rc1.y == rc2.y && rc1.width == rc2.width && rc1.height == rc2.height);

        const x = rc2.width  * (pt.x - this.svg.viewBox.baseVal.x) / this.svg.viewBox.baseVal.width;
        let   y = rc2.height * (pt.y - this.svg.viewBox.baseVal.y) / this.svg.viewBox.baseVal.height;

        if(this.FlipY){
    
            y = rc2.height - y;
        }


        return new Vec2(x, y);
    }

    toSvg2(x:number) : number{
        return x * this.svgRatio;
    }

    G0toG1(){
        const v = Array.from(this.G0.childNodes.values());
        for(let x of v){
            if(!(x instanceof SVGImageElement)){

                this.G0.removeChild(x);
                this.G1.appendChild(x);
            }
        }
    }
}

export abstract class Shape extends ShapeWidget {
    parentView : View;
    selected: boolean = false;

    processEvent(sources: Shape[]){}
    listeners:Shape[] = [];     //!!! リネーム注意 !!!

    select(selected: boolean){
        this.selected = selected;
    }

    click =(ev: MouseEvent, pt:Vec2): void => {}
    pointermove = (ev: PointerEvent) : void => {}

    constructor(){
        super();

        this.parentView = view;
        this.parentView.shapes.push(this);
    }

    makeObj() : any {
        let obj = Object.assign(super.makeObj(), {
            parentView : this.parentView.toObj()
        });

        if(this.listeners.length != 0){
            obj.listeners = this.listeners.map(x => ({ ref: x.id }) );
        }

        return obj;
    }

    finishTool(){
        this.parentView.G0toG1();
    
        let selected_shapes = allShapes().filter(x => x.parentView == this.parentView && x.selected);
        selected_shapes.forEach(x => x.select(false));
    
        console.assert(this.parentView.tool != null);
        glb.widgets.push(this.parentView.tool!);
        this.parentView.tool = null;
    }

    bind(pt: Point){
        this.listeners.push(pt);
        pt.bindTo = this;
    }

    makeEventGraph(src:Shape|null){
        // イベントのリスナーに対し
        for(let shape of this.listeners){
            
            // ビューのイベントキューのイベントグラフに追加する。
            this.parentView.eventQueue.addEventMakeEventGraph(shape, this);
        }
    }

    toSvg(x:number) : number{
        return x * this.parentView.svgRatio;
    }    
}

export abstract class CompositeShape extends Shape {
    handles : Point[] = [];

    all(v: Widget[]){
        super.all(v);
        this.handles.forEach(x => x.all(v));
    }

    addHandle(handle: Point, useThisHandleMove: boolean = true){

        if(useThisHandleMove){

            handle.listeners.push(this);
        }
        this.handles.push(handle);
    }

    makeObj() : any {
        return Object.assign(super.makeObj() , {
            handles : this.handles.map(x => x.toObj())
        });
    }

    delete(){
        for(let x of this.handles){
            x.delete();
        }
    }
}

export class Point extends Shape {
    pos : Vec2 = new Vec2(NaN, NaN);
    bindTo: Shape|undefined;    //!!! リネーム注意 !!!

    circle : SVGCircleElement;

    constructor(obj: any){
        super();

        console.assert(obj.pos != undefined);
        super.make(obj);
        console.assert(! isNaN(this.pos.x));

        this.circle = document.createElementNS("http://www.w3.org/2000/svg","circle");
        this.circle.setAttribute("r", `${this.toSvg(5)}`);
        this.circle.setAttribute("fill", "blue");
        setPointEventListener(this);

        this.circle.style.cursor = "pointer";

        this.setPos();
    
        this.parentView.G2.appendChild(this.circle);

        return this;
    }

    propertyNames() : string[] {
        return [ "X", "Y" ];
    }

    makeObj() : any {
        let obj = Object.assign(super.makeObj(), {
             pos: this.pos 
        });

        if(this.bindTo != undefined){
            obj.bindTo = { ref: this.bindTo.id };
        }

        return obj;
    }

    summary() : string {
        return "点";
    }

    getX(){
        return this.pos.x;
    }

    setX(value:any){
        this.pos.x =  parseInt(value);
        this.setPos();
    }

    getY(){
        return this.pos.y;
    }

    setY(value:any){
        this.pos.y =  parseInt(value);
        this.setPos();
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        this.pos = pt;

        const line = getLine(ev);

        if(line == null){

            this.setPos();
        }
        else{

            line.bind(this)
            line.adjust(this);
        }

        this.finishTool();
    }

    setPos(){
        this.circle.setAttribute("cx", "" + this.pos.x);
        this.circle.setAttribute("cy", "" + this.pos.y);
    }

    select(selected: boolean){
        if(this.selected != selected){
            this.selected = selected;

            if(this.selected){
                this.circle.setAttribute("fill", "orange");
            }
            else{
                this.circle.setAttribute("fill", "blue");
            }
        }
    }

    private dragPoint(ev: PointerEvent){
        this.pos = getSvgPoint(ev, this);
        if(this.bindTo != undefined){

            if(this.bindTo instanceof LineSegment){
                    (this.bindTo as LineSegment).adjust(this);
            }
            else if(this.bindTo instanceof Circle){
                (this.bindTo as Circle).adjust(this);
            }
            else{
                console.assert(false);
            }
        }
        else{

            this.setPos();
        }
    }

    processEvent =(sources: Shape[])=>{
        if(this.bindTo != undefined){

            if(this.bindTo instanceof LineSegment){
                    (this.bindTo as LineSegment).adjust(this);
            }
            else if(this.bindTo instanceof Circle){
                (this.bindTo as Circle).adjust(this);
            }
        }
    }

    pointerdown =(ev: PointerEvent)=>{
        if(this.parentView.toolType != "select"){
            return;
        }

        this.parentView.capture = this;
        this.circle.setPointerCapture(ev.pointerId);
    }

    pointermove =(ev: PointerEvent)=>{
        if(this.parentView.toolType != "select"){
            return;
        }

        if(this.parentView.capture != this){
            return;
        }

        this.dragPoint(ev);

        this.makeEventGraph(null);
        this.parentView.eventQueue.processQueue();
    }

    pointerup =(ev: PointerEvent)=>{
        if(this.parentView.toolType != "select"){
            return;
        }

        this.circle.releasePointerCapture(ev.pointerId);
        this.parentView.capture = null;

        this.dragPoint(ev);

        this.makeEventGraph(null);
        this.parentView.eventQueue.processQueue();
    }

    delete(){
        this.circle.parentElement!.removeChild(this.circle);
    }
}

export class LineSegment extends CompositeShape {    
    line : SVGLineElement;
    p1: Vec2 = new Vec2(0,0);
    p2: Vec2 = new Vec2(0,0);
    p12: Vec2 = new Vec2(0,0);
    e: Vec2 = new Vec2(0,0);
    len: number = 0;

    constructor(){
        super();
        //---------- 
        this.line = document.createElementNS("http://www.w3.org/2000/svg","line");
        this.line.setAttribute("stroke", "navy");
        this.line.setAttribute("stroke-width", `${this.toSvg(strokeWidth)}`);

        this.parentView.G0.appendChild(this.line);
    }

    make(obj: any) : Widget {
        super.make(obj);
        for(let p of this.handles){
            console.assert(!isNaN(p.pos.x))
        }
        this.updatePos();
        this.line.style.cursor = "move";

        return this;
    }

    makeByPos(x1: number, y1: number, x2: number, y2: number){
        this.line.style.cursor = "move";
        this.addHandle(new Point({pos:new Vec2(x1, y1)}));
        this.addHandle(new Point({pos:new Vec2(x2, y2)}));
        this.updatePos();

        return this;
    }

    propertyNames() : string[] {
        return [ "Color" ];
    }

    getColor(){
        return this.line.getAttribute("stroke")!;
    }

    setColor(c:string){
        this.line.setAttribute("stroke", c);
    }
    
    select(selected: boolean){
        if(this.selected != selected){
            this.selected = selected;

            if(this.selected){
                this.line.setAttribute("stroke", "orange");
            }
            else{
                this.line.setAttribute("stroke", "navy");
            }
        }
    }

    setPoints(p1:Vec2, p2:Vec2){
        this.line.setAttribute("x1", "" + p1.x);
        this.line.setAttribute("y1", "" + p1.y);

        this.line.setAttribute("x2", "" + p2.x);
        this.line.setAttribute("y2", "" + p2.y);

        if(this.handles.length != 0){
            this.handles[0].pos = p1;

            if(this.handles.length == 2){
                this.handles[1].pos = p2;
                this.handles[1]

                this.setVecs();
            }
        }
    }

    updatePos(){
        this.line.setAttribute("x1", "" + this.handles[0].pos.x);
        this.line.setAttribute("y1", "" + this.handles[0].pos.y);

        if(this.handles.length == 1){

            this.line.setAttribute("x2", "" + this.handles[0].pos.x);
            this.line.setAttribute("y2", "" + this.handles[0].pos.y);
        }
        else{

            this.line.setAttribute("x2", "" + this.handles[1].pos.x);
            this.line.setAttribute("y2", "" + this.handles[1].pos.y);

            this.setVecs();
        }
    }

    processEvent =(sources: Shape[])=>{
        for(let src of sources){
            if(src == this.handles[0]){

                const handle = this.handles[0];
                this.line.setAttribute("x1", "" + handle.pos.x);
                this.line.setAttribute("y1", "" + handle.pos.y);
            }
            else if(src == this.handles[1]){
                
                const handle = this.handles[1];
                this.line.setAttribute("x2", "" + handle.pos.x);
                this.line.setAttribute("y2", "" + handle.pos.y);
            }
            else{
                console.assert(src instanceof Rect || src instanceof ParallelLine);
            }
        }

        this.setVecs();
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        this.addHandle(clickHandle(ev, pt));

        this.line.setAttribute("x2", "" + pt.x);
        this.line.setAttribute("y2", "" + pt.y);
        if(this.handles.length == 1){

            this.line.setAttribute("x1", "" + pt.x);
            this.line.setAttribute("y1", "" + pt.y);
        }
        else{
            this.line.style.cursor = "move";
            this.setVecs();

            this.finishTool();
        }    
    }

    pointermove =(ev: PointerEvent) : void =>{
        const pt = getSvgPoint(ev, null);

        this.line!.setAttribute("x2", "" + pt.x);
        this.line!.setAttribute("y2", "" + pt.y);
    }

    setVecs(){
        this.p1 = this.handles[0].pos;
        this.p2 = this.handles[1].pos;
        this.p12 = this.p2.sub(this.p1);
        this.e = this.p12.unit();
        this.len = this.p12.len();
    }

    adjust(handle: Point) {
        let posInLine;

        if(this.len == 0){
            posInLine = 0;
        }
        else{
            posInLine = this.e.dot(handle.pos.sub(this.p1)) / this.len;
        }
        handle.pos = this.p1.add(this.p12.mul(posInLine));
        handle.setPos();
    }

    delete(){
        super.delete();
        this.line.parentElement!.removeChild(this.line);
    }
}

export class BSpline extends CompositeShape {  
    static six = 1 / 6;  
    static Bs : Float64Array[];
    paths: SVGPathElement[];
    points: Vec2[] = [];

    constructor(){
        super();

        if(BSpline.Bs == undefined){

            BSpline.Bs = [];

            for(let i = 0; i < 10; i++){
                let s  = i * 0.1;
                let b0 = this.B0(0 + s);
                let b1 = this.B1(1 + s);
                let b2 = this.B2(2 + s);
                let b3 = this.B3(3 + s);

                BSpline.Bs.push(new Float64Array([b0, b1, b2, b3]));
            }
        }

        this.paths = [];
        const colors = [ "green", "red", "blue"]
        for(let idx of range(3)){

            let path = document.createElementNS("http://www.w3.org/2000/svg","path");

            path.setAttribute("fill", "none");
            path.setAttribute("stroke", colors[idx]);
            if(idx == 1){

                path.setAttribute("stroke-width", `${2 * this.toSvg(thisStrokeWidth)}`);
            }
            else{

                path.setAttribute("stroke-width", `${this.toSvg(thisStrokeWidth)}`);
            }

            this.paths.push(path);
            this.parentView.G0.appendChild(path);
        };
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        this.addHandle(clickHandle(ev, pt));

        this.points.push( getSvgPoint(ev, null) );

        if(this.handles.length == 2){

            bansho.msg(`b-spline ${this.points.length}`);
            this.drawPath();
            this.finishTool();
        }
    }

    pointermove =(ev: PointerEvent) : void =>{
        const pt = getSvgPoint(ev, null);

        this.points.push(pt);
        this.drawPath();
    }

    drawPath(){
        const d0 = "M" + this.points.map(p => `${p.x},${p.y}`).join(" ");
        this.paths[0].setAttribute("d", d0);

        const n = 10;
        const v = [];
        const v3 = [];

        for(let idx = 0; idx < this.points.length ;idx += n ){
            let p0 = this.points[idx];
            let p1 : Vec2;
            let p2 : Vec2;
            let p3 : Vec2;

            if(idx + n < this.points.length){
                p1 = this.points[idx + n];
            }
            else{
                p1 = p0;
            }

            if(idx + 2 * n < this.points.length){
                p2 = this.points[idx + 2 * n];
            }
            else{
                p2 = p1;
            }

            if(idx + 3 * n < this.points.length){
                p3 = this.points[idx + 3 * n];
            }
            else{
                p3 = p2;
            }
    

            for(let i = 0; i < 10; i++){
                let [b0, b1, b2, b3] = BSpline.Bs[i];

                let x = p0.x * b3 + p1.x * b2 + p2.x * b1 + p3.x * b0; 
                let y = p0.y * b3 + p1.y * b2 + p2.y * b1 + p3.y * b0; 
                v.push([x,y]);
            }

            let p02 = p0.divide(2/3, p1);
            let p11 = p1.divide(1/3, p2);
            let p12 = p1.divide(2/3, p2);
            let p21 = p2.divide(1/3, p3);

            let a   = p02.divide(0.5, p11);
            let b   = p12.divide(0.5, p21);

            v3.push(`M${a.x} ${a.y} C ${p11.x} ${p11.y}, ${p12.x} ${p12.y}, ${b.x} ${b.y}`);
        }

        if(2 <= v.length){

            const d1 = "M" + v.map(([x,y]) => `${x},${y}`).join(" ");
            this.paths[1].setAttribute("d", d1);
        }

        if(v3.length != 0){

            const d2 = v3.join(" ");
            this.paths[2].setAttribute("d", d2);
        }
    }

    B0(t: number){
        return BSpline.six * t * t * t;
    }

    B1(t: number){
        const t2 = t * t;
        return BSpline.six * (- 3 * t * t2 + 12 * t2 - 12 * t + 4 );
    }

    B2(t: number){
        const t2 = t * t;
        return BSpline.six * ( 3 * t * t2 - 24 * t2 + 60 * t - 44 );
    }

    B3(t: number){
        const t4 = t - 4
        return - BSpline.six * t4 * t4 * t4;
    }
}

export class Rect extends CompositeShape {
    isSquare: boolean = true;
    lines : Array<LineSegment> = [];
    h : number = -1;
    inSetRectPos : boolean = false;

    constructor(){
        super();
    }

    makeObj() : any {
        return Object.assign(super.makeObj(), {
            isSquare: this.isSquare,
            lines: this.lines.map(x => x.toObj())
        });
    }

    all(v: Widget[]){
        super.all(v);
        this.lines.forEach(x => x.all(v));
    }

    setRectPos(pt: Vec2|null, idx: number, clicked:boolean){
        if(this.inSetRectPos){
            return;
        }
        this.inSetRectPos = true;

        const p1 = this.handles[0].pos; 

        let p2;

        if(this.handles.length == 1){

            p2 = pt!;
        }
        else{

            p2 = this.handles[1].pos; 
        }

        const p12 = p2.sub(p1);

        const e = (new Vec2(- p12.y, p12.x)).unit();

        let h;
        if(this.isSquare){

            h = p12.len();
        }
        else{

            if(this.h == -1 || idx == 2){

                let pa;
                if(this.handles.length < 4){
        
                    pa = pt!;
        
                }
                else{
        
                    pa = this.handles[2].pos; 
                }
        
                const p0a = pa.sub(p1);
                h = e.dot(p0a);
    
                if(this.handles.length == 4){
                    this.h = h;
                }
            }
            else{
                h = this.h;
            }
        }

        const eh = e.mul(h);
        const p3 = p2.add(eh);
        const p4 = p3.add(p1.sub(p2));

        const line1 = this.lines[0];
        line1.setPoints(p1, p2);

        const line2 = this.lines[1];
        line2.setPoints(p2, p3);

        const line3 = this.lines[2];
        line3.setPoints(p3, p4);

        const line4 = this.lines[3];
        line4.setPoints(p4, p1);

        if(clicked){
            if(this.handles.length == 2 && this.isSquare){

                line1.addHandle(this.handles[1], false);
                line2.addHandle(this.handles[1], false);

                line1.line.style.cursor = "move";
                
                const handle3 = new Point({pos:p3});
                this.handles.push(handle3);
            }

            switch(this.handles.length){
            case 1:
                line1.addHandle(this.handles[0], false);
                break;
            case 2:
                line1.addHandle(this.handles[1], false);
                line2.addHandle(this.handles[1], false);

                line1.line.style.cursor = "move";

                break;
            case 3:
                line2.addHandle(this.handles[2], false);
                line2.line.style.cursor = "move";

                const handle4 = new Point({pos:p4});
                this.handles.push(handle4);

                line3.addHandle(this.handles[2], false);
                line3.addHandle(handle4, false);
                line3.line.style.cursor = "move";

                line4.addHandle(handle4, false);
                line4.addHandle(this.handles[0], false);
                line4.line.style.cursor = "move";
                break;
            }
        }

        if(3 <= this.handles.length){

            this.handles[2].pos = p3;
            this.handles[2].setPos();
    
            if(this.handles.length == 4){

                this.handles[3].pos = p4;
                this.handles[3].setPos();        
            }
        }

        this.inSetRectPos = false;
    }

    makeEventGraph(src:Shape|null){
        super.makeEventGraph(src);

        if(src == this.handles[0] || src == this.handles[1]){

            this.parentView.eventQueue.addEventMakeEventGraph(this.handles[2], this);
        }
        else{
            console.assert(src == this.handles[2]);
        }

        for(let line of this.lines){

            this.parentView.eventQueue.addEventMakeEventGraph(line, this);
        }
    }

    processEvent =(sources: Shape[])=>{
        for(let source of sources){
            console.assert(source.constructor.name == "Point");
            let i = this.handles.indexOf(source as Point);
            console.assert([0, 1, 2].includes(i));
        }

        const handle = sources[0] as Point;

        const idx = this.handles.indexOf(handle);
        this.setRectPos(handle.pos, idx, false);
    }

    click =(ev: MouseEvent, pt:Vec2): void =>{
        if(this.lines.length == 0){

            for(let i = 0; i < 4; i++){

                const line = new LineSegment();
                this.lines.push(line);
            }
        }

        this.addHandle(clickHandle(ev, pt));

        this.setRectPos(pt, -1, true);

        if(this.handles.length == 4){

            for(let line of this.lines){
                console.assert(line.handles.length == 2);
                line.setVecs();
            }
            this.finishTool();
        }    
    }

    pointermove =(ev: PointerEvent) : void =>{
        const pt = getSvgPoint(ev, null);

        this.setRectPos(pt, -1, false);
    }
}

export class Circle extends CompositeShape {
    byDiameter:boolean;
    center: Vec2|null = null;
    radius: number = this.toSvg(1);
    
    circle: SVGCircleElement;

    constructor(by_diameter: boolean){
        super();

        this.byDiameter = by_diameter;

        this.circle = document.createElementNS("http://www.w3.org/2000/svg","circle");
        this.circle.setAttribute("fill", "none");// "transparent");
        this.circle.setAttribute("stroke", "navy");
        this.circle.setAttribute("stroke-width", `${this.toSvg(strokeWidth)}`);     
        this.circle.setAttribute("fill-opacity", "0");
        
        this.parentView.G0.appendChild(this.circle);    
    }

    makeObj() : any {
        return Object.assign(super.makeObj(), {
            byDiameter: this.byDiameter,
            center: this.center,
            radius: this.radius
        });
    }

    propertyNames() : string[] {
        return [ "Color" ];
    }

    make(obj: any) : Widget {
        super.make(obj);

        this.circle.setAttribute("cx", "" + this.center!.x);
        this.circle.setAttribute("cy", "" + this.center!.y);
        this.circle.setAttribute("r", "" + this.radius);

        return this;
    }

    getColor(){
        return this.circle.getAttribute("stroke")!;
    }

    setColor(c:string){
        this.circle.setAttribute("stroke", c);
    }

    setCenter(pt: Vec2){
        this.center = this.handles[0].pos.add(pt).mul(0.5);

        this.circle.setAttribute("cx", "" + this.center.x);
        this.circle.setAttribute("cy", "" + this.center.y);
    }

    setRadius(pt: Vec2){
        this.radius = this.center!.dist(pt);
        this.circle!.setAttribute("r", "" +  this.radius );
    }

    processEvent =(sources: Shape[])=>{
        for(let src of sources){
            if(src == this.handles[0]){

                if(this.byDiameter){

                    this.setCenter(this.handles[1].pos);
                }
                else{
        
                    this.center = this.handles[0].pos;
                    this.circle.setAttribute("cx", "" + this.handles[0].pos.x);
                    this.circle.setAttribute("cy", "" + this.handles[0].pos.y);
                }
        
                this.setRadius(this.handles[1].pos);
            }
            else if(src == this.handles[1]){

                if(this.byDiameter){
                    this.setCenter(this.handles[1].pos);
                }

                this.setRadius(this.handles[1].pos);
            }
            else{
                console.assert(false);
            }
        }
    }

    click =(ev: MouseEvent, pt:Vec2): void =>{
        this.addHandle(clickHandle(ev, pt));

        if(this.handles.length == 1){

            this.center = pt;

            this.circle.setAttribute("cx", "" + pt.x);
            this.circle.setAttribute("cy", "" + pt.y);
            this.circle.setAttribute("r", "" + this.radius);
        }
        else{
            if(this.byDiameter){

                this.setCenter(pt);
            }
    
            this.setRadius(pt);
            this.circle.style.cursor = "move";
    
            this.finishTool();
        }
    }

    pointermove =(ev: PointerEvent) : void =>{
        const pt = getSvgPoint(ev, null);

        if(this.byDiameter){

            this.setCenter(pt);
        }
        this.setRadius(pt);
    }

    adjust(handle: Point) {
        const v = handle.pos.sub(this.center!);
        const theta = Math.atan2(v.y, v.x);

        handle.pos = new Vec2(this.center!.x + this.radius * Math.cos(theta), this.center!.y + this.radius * Math.sin(theta));

        handle.setPos();
    }
}

export class DimensionLine extends CompositeShape {
    arcs: SVGPathElement[];
    lines : SVGLineElement[];

    constructor(){
        super();

        this.arcs = [];
        this.lines = [];

        for(let i = 0; i < 2; i++){

            const arc = document.createElementNS("http://www.w3.org/2000/svg","path");

            arc.setAttribute("fill", "none");
            arc.setAttribute("stroke", "red");
            arc.setAttribute("stroke-width", `${this.toSvg(thisStrokeWidth)}`);
            arc.style.cursor = "pointer";
            arc.style.zIndex = "-2";

            this.parentView.G0.appendChild(arc);

            this.arcs.push(arc);

            const line = document.createElementNS("http://www.w3.org/2000/svg","line");
            line.setAttribute("stroke", "red");
            line.setAttribute("stroke-width", `${this.toSvg(thisStrokeWidth)}`);
    
            this.parentView.G0.appendChild(line);
    
            this.lines.push(line);
        }
    }

    make(obj: any) : Widget {
        super.make(obj);
        this.drawPath(this.handles[2].pos);

        return this;
    }

    processEvent =(sources: Shape[])=>{
        this.drawPath(this.handles[2].pos);
    }

    click =(ev: MouseEvent, pt:Vec2): void =>{
        this.addHandle(clickHandle(ev, pt));

        if(this.handles.length == 3){
    
            this.finishTool();
        }
    }

    pointermove =(ev: PointerEvent) : void =>{
        if(this.handles.length != 2){
            return;
        }

        this.drawPath(getSvgPoint(ev, null));
    }

    drawPath(p3: Vec2){
        const p1 = this.handles[0].pos;
        const p2 = this.handles[1].pos;

        const p21 = p1.sub(p2);
        const p23 = p3.sub(p2);
        const l1 = p21.unit().dot(p23);
        const p4 = p2.add(p21.unit().mul(l1));

        const v = p3.sub(p4);
        const r = v.len();
        const r2 = Math.min(r, p21.len() / 2);

        const p1c = p1.add(v);
        const p1d = p1c.add(p21.unit().mul(-r2));
        const d1 = `M${p1.x} ${p1.y} Q ${p1c.x} ${p1c.y} ${p1d.x} ${p1d.y}`;

        this.arcs[0].setAttribute("d", d1);

        const p2c = p2.add(v);
        const p2d = p2c.add(p21.unit().mul(r2));
        const d2 = `M${p2.x} ${p2.y} Q ${p2c.x} ${p2c.y} ${p2d.x} ${p2d.y}`;

        this.arcs[1].setAttribute("d", d2);


        const line_len = Math.min(l1, p21.len() / 2) - r;
        if(0 < line_len){

            this.lines[0].setAttribute("x1", "" + p1d.x);
            this.lines[0].setAttribute("y1", "" + p1d.y);

            const p5 = p1d.add(p21.unit().mul(- line_len))
            this.lines[0].setAttribute("x2", "" + p5.x);
            this.lines[0].setAttribute("y2", "" + p5.y);


            this.lines[1].setAttribute("x1", "" + p2d.x);
            this.lines[1].setAttribute("y1", "" + p2d.y);

            const p6 = p2d.add(p21.unit().mul(line_len))
            this.lines[1].setAttribute("x2", "" + p6.x);
            this.lines[1].setAttribute("y2", "" + p6.y);

            this.lines.forEach(x => x.style.visibility = "visible");
        }
        else{
            this.lines.forEach(x => x.style.visibility = "hidden");
        }

    }
}

export class Triangle extends CompositeShape {
    lines : Array<LineSegment> = [];

    makeObj() : any {
        return Object.assign(super.makeObj(), {
            lines: this.lines.map(x => x.toObj()) 
        });
    }

    all(v: Widget[]){
        super.all(v);
        this.lines.forEach(x => x.all(v));
    }

    click =(ev: MouseEvent, pt:Vec2): void =>{
        const line = new LineSegment();

        if(this.lines.length == 0){
            line.addHandle(clickHandle(ev, pt));
        }
        else{

            const lastLine = arrayLast(this.lines);
            const handle = clickHandle(ev, pt);
            lastLine.addHandle(handle);
            lastLine.updatePos();
            lastLine.line.style.cursor = "move";

            line.addHandle(handle);
        }

        if(this.lines.length == 2){

            const handle1 = this.lines[0].handles[0];

            line.addHandle(handle1);
            line.line.style.cursor = "move";

            this.finishTool();
        }

        this.lines.push(line);
        line.updatePos();
    }

    pointermove =(ev: PointerEvent) : void =>{
        const lastLine = arrayLast(this.lines);
        lastLine.pointermove(ev);
    }
}

export class TextBox extends CompositeShape {   
    domPos: Vec2 | null = null;
    Text: string = "テキスト";

    div : HTMLDivElement;

    constructor(){
        super();

        this.div = document.createElement("div");
        this.div.style.position = "absolute";
        this.div.style.backgroundColor = "cornsilk";
        this.div.style.cursor = "move";
        this.div.style.zIndex = "-1";

        this.parentView.div.appendChild(this.div);
    }

    makeObj() : any {
        return Object.assign(super.makeObj(), {
            domPos: this.domPos,
            Text: this.Text
        });
    }

    make(obj: any) : TextBox {
        super.make(obj);

        this.div.id = getBlockId(this);
        this.div.innerHTML = bansho.makeHtmlLines(this.Text);

        if(this.domPos != null){
            this.updatePos();
        }

        MathJax.typesetPromise([this.div]);

        return this;
    }

    propertyNames() : string[] {
        return [ "Text" ];
    }

    setText(text: string){
        this.Text = text;

        this.div.innerHTML = bansho.makeHtmlLines(this.Text);
        MathJax.typesetPromise([this.div]);
    }

    processEvent =(sources: Shape[])=>{
        console.assert(sources.length == 1 && sources[0] == this.handles[0]);
        msg(`text pos ${this.handles[0].pos.x} ${this.handles[0].pos.y} `);

        this.domPos = this.parentView.SvgToDomPos(this.handles[0].pos);
        this.updatePos();
    }

    click =(ev: MouseEvent, pt:Vec2) : void =>{
        this.addHandle(clickHandle(ev, pt));
        this.domPos = new Vec2(ev.offsetX, ev.offsetY);

        this.updatePos();

        this.finishTool();
    }

    updatePos(){
        this.div.style.left  = `${this.domPos!.x}px`;
        this.div.style.top   = `${this.domPos!.y}px`;
    }
}

export class Midpoint extends CompositeShape {
    midpoint : Point | null = null;

    makeObj() : any {
        return Object.assign(super.makeObj(), {
            midpoint: this.midpoint!.toObj()
        });
    }

    all(v: Widget[]){
        super.all(v);
        console.assert(this.midpoint != null);
        this.midpoint!.all(v);
    }

    calcMidpoint(){
        const p1 = this.handles[0].pos;
        const p2 = this.handles[1].pos;

        return new Vec2((p1.x + p2.x)/2, (p1.y + p2.y)/2);
    }

    makeEventGraph(src:Shape|null){
        super.makeEventGraph(src);

        this.parentView.eventQueue.addEventMakeEventGraph(this.midpoint!, this);
    }

    processEvent =(sources: Shape[])=>{
        this.midpoint!.pos = this.calcMidpoint();
        this.midpoint!.setPos();
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        this.addHandle(clickHandle(ev, pt));

        if(this.handles.length == 2){

            this.midpoint = new Point({pos:this.calcMidpoint()});

            this.finishTool();
        }
    }
}


export class Perpendicular extends CompositeShape {
    line : LineSegment | null = null;
    foot : Point | null = null;
    perpendicular : LineSegment | null = null;
    inHandleMove: boolean = false;
    
    makeObj() : any {
        return Object.assign(super.makeObj(), {
            line: this.line!.toObj(),
            foot: this.foot!.toObj(),
            perpendicular: this.perpendicular!.toObj()
        });
    }

    all(v: Widget[]){
        super.all(v);
        this.line!.all(v);
        this.foot!.all(v);
        this.perpendicular!.all(v);
    }

    makeEventGraph(src:Shape|null){
        super.makeEventGraph(src);

        this.parentView.eventQueue.addEventMakeEventGraph(this.foot!, this);
    }

    processEvent =(sources: Shape[])=>{
        if(this.inHandleMove){
            return;
        }
        this.inHandleMove = true;

        this.foot!.pos = calcFootOfPerpendicular(this.handles[0].pos, this.line!);
        this.foot!.setPos();

        this.perpendicular!.setPoints(this.handles[0].pos, this.foot!.pos);

        this.inHandleMove = false;
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        if(this.handles.length == 0){

            this.addHandle(clickHandle(ev, pt));
        }
        else {

            this.line = getLine(ev);
            if(this.line == null){
                return;
            }

            this.line.listeners.push(this);

            this.foot = new Point({pos:calcFootOfPerpendicular(this.handles[0].pos, this.line!)});

            this.perpendicular = new LineSegment();
            this.perpendicular.line.style.cursor = "move";
            this.perpendicular.addHandle(this.handles[0]);
            this.perpendicular.addHandle(this.foot, false);

            this.perpendicular.setVecs();
            this.perpendicular.updatePos();

            this.finishTool();
        }
    }
}

export class ParallelLine extends CompositeShape {
    line1 : LineSegment | null = null;
    line2 : LineSegment | null = null;
    point : Point|null = null;

    all(v: Widget[]){
        super.all(v);
        this.line1!.all(v);
        this.line2!.all(v);
        this.point!.all(v);
    }
    
    makeObj() : any {
        return Object.assign(super.makeObj(), {
            line1: this.line1!.toObj(),
            line2: this.line2!.toObj(),
            point: this.point!.toObj()
        });
    }

    calcParallelLine(){
        const p1 = this.point!.pos.add(this.line1!.e.mul(infinity));
        const p2 = this.point!.pos.sub(this.line1!.e.mul(infinity));

        this.line2!.setPoints(p1, p2);
    }

    makeEventGraph(src:Shape|null){
        super.makeEventGraph(src);

        this.parentView.eventQueue.addEventMakeEventGraph(this.line2!, this);
    }

    processEvent =(sources: Shape[])=>{
        this.calcParallelLine();
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        if(this.line1 == null){

            this.line1 = getLine(ev);
            if(this.line1 == null){
                return;
            }

            this.line1.select(true);
            this.line1.listeners.push(this);
        }
        else {

            this.point = getPoint(ev);
            if(this.point == null){
                return;
            }

            this.point.listeners.push(this);

            this.line2 = new LineSegment();
            this.line2.line.style.cursor = "move";

            this.line2.addHandle(new Point({pos:new Vec2(0,0)}));
            this.line2.addHandle(new Point({pos:new Vec2(0,0)}));
            this.calcParallelLine();
            for(let handle of this.line2.handles){
                handle.setPos();
            }

            this.finishTool();
        }
    }
}

export class Intersection extends CompositeShape {
    lines : LineSegment[] = [];
    intersection : Point|null = null;

    makeObj() : any {
        return Object.assign(super.makeObj(), {
            lines: this.lines.map(x => x.toObj()),
            intersection: this.intersection!.toObj()
        });
    }

    all(v: Widget[]){
        super.all(v);
        this.lines.forEach(x => x.all(v));
        this.intersection!.all(v);
    }

    makeEventGraph(src:Shape|null){
        super.makeEventGraph(src);

        this.parentView.eventQueue.addEventMakeEventGraph(this.intersection!, this);
    }

    processEvent =(sources: Shape[])=>{
        this.intersection!.pos = linesIntersection(this.lines[0], this.lines[1]);
        this.intersection!.setPos();
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        const line = getLine(ev);
        
        if(line != null){
            this.lines.push(line);

            if(this.lines.length == 1){


                line.select(true);
            }
            else{

                const v = linesIntersection(this.lines[0], this.lines[1]);
                this.intersection = new Point({pos:v});

                for(let line2 of this.lines){

                    line2.listeners.push(this);
                }

                this.finishTool();
            }
        }
    }

    pointermove = (ev: PointerEvent) : void => {
    }
}

enum AngleMark {
    rightAngle,
    arc,
    arc2,
    arc3,
    prime,
    prime2,
    prime3,
}

export class Angle extends CompositeShape {
    lines : LineSegment[] = [];
    Mark: AngleMark = AngleMark.arc;
    handleIdx: number[] = [];

    downPos: Vec2[] = [];
    arcs   : SVGPathElement[] = [];
    primes : SVGLineElement[] = [];
    Color : string = "black";

    constructor(){
        super();
    }
    
    makeObj() : any {
        return Object.assign(super.makeObj(), {
            lines: this.lines.map(x => x.toObj()),
            Mark : this.Mark,
            handleIdx: Array.from(this.handleIdx)
        });
    }

    make(obj: any) : Widget {
        super.make(obj);
        this.drawArc();

        return this;
    }

    all(v: Widget[]){
        super.all(v);
        this.lines.forEach(x => x.all(v));
    }

    propertyNames() : string[] {
        return [ "Mark", "Color" ];
    }

    *restore(){
        this.drawArc();
    }

    setMark(mark: AngleMark){
        this.Mark = mark;
        msg(`mark:${mark}`);

        this.drawArc();
    }

    setColor(c:string){
        this.Color = c;
        for(let arc of this.arcs){

            arc.setAttribute("stroke", c);
        }
    }

    matchArcs(){
        let num_arc = this.numArc();
        while(num_arc < this.arcs.length){
            let arc = this.arcs.pop()!;
            arc.parentElement!.removeChild(arc);
        }

        while(this.arcs.length < num_arc){
            let arc = document.createElementNS("http://www.w3.org/2000/svg","path");

            arc.setAttribute("fill", "none");
            arc.setAttribute("stroke", this.Color);
            arc.setAttribute("stroke-width", `${this.toSvg(angleStrokeWidth)}`);
            arc.style.cursor = "pointer";
    
            this.parentView.G0.appendChild(arc);
            this.arcs.push(arc);
        }

        let num_prime = this.numPrime();
        while(num_prime < this.primes.length){
            let prime = this.primes.pop()!;
            prime.parentElement!.removeChild(prime);
        }

        while(this.primes.length < num_prime){
            let prime = document.createElementNS("http://www.w3.org/2000/svg","line");
            prime.setAttribute("stroke", "navy");
            prime.setAttribute("stroke-width", `${this.toSvg(angleStrokeWidth)}`);
            prime.style.cursor = "pointer";
    
            this.parentView.G0.appendChild(prime);
            this.primes.push(prime);
        }

        return [num_arc, num_prime];
    }

    drawRightAngle(p: Vec2, q1: Vec2, q2: Vec2){
        const r = this.toSvg(40);
        const p1 = p.add(q1.mul(r));
        const p2 = p.add(q2.mul(r));
        const p3 = p1.add(q2.mul(r));

        const ps = [[p1, p3], [p2, p3]];
        for(let [i, prime] of this.primes.entries()){
            prime.setAttribute("x1", `${ps[i][0].x}`);
            prime.setAttribute("y1", `${ps[i][0].y}`);
            prime.setAttribute("x2", `${ps[i][1].x}`);
            prime.setAttribute("y2", `${ps[i][1].y}`);
        }
    }

    drawArc(){
        let [num_arc, num_prime] = this.matchArcs();

        const line1 = this.lines[0];
        const line2 = this.lines[1];

        // 交点
        const p = linesIntersection(this.lines[0], this.lines[1]);

        // 交点から線分上の点までの単位ベクトル
        const q1 = line1.handles[this.handleIdx[0]].pos.sub(p).unit();
        const q2 = line2.handles[this.handleIdx[1]].pos.sub(p).unit();

        if(this.Mark == AngleMark.rightAngle){
            // 直角の場合

            this.drawRightAngle(p, q1, q2);
            return;
        }

        // 線分上の点の角度
        let theta1 = Math.atan2(q1.y, q1.x);
        let theta2 = Math.atan2(q2.y, q2.x);

        if(theta1 < 0){
            theta1 += 2 * Math.PI;
        }
        if(theta2 < 0){
            theta2 += 2 * Math.PI;
        }
        
        let deltaTheta = theta2 - theta1;
        if(deltaTheta < 0){
            deltaTheta += 2 * Math.PI;
        }

        const largeArcSweepFlag = (Math.PI < deltaTheta ? 1 : 0);

        for(let [i, arc] of this.arcs.entries()){

            const r = this.toSvg(40) * (1 + 0.1 * i);
            const p1 = p.add(q1.mul(r));
            const p2 = p.add(q2.mul(r));

            const d = `M${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArcSweepFlag} 1 ${p2.x} ${p2.y}`;

            arc.setAttribute("d", d);
        }

        for(let [i, prime] of this.primes.entries()){
            let theta = theta1 + deltaTheta * (i + 1) / (num_prime + 1);

            const r = this.toSvg(40);

            const x1 = p.x + r * 0.9 * Math.cos(theta);
            const y1 = p.y + r * 0.9 * Math.sin(theta);

            const x2 = p.x + r * 1.1 * Math.cos(theta);
            const y2 = p.y + r * 1.1 * Math.sin(theta);

            prime.setAttribute("x1", `${x1}`);
            prime.setAttribute("y1", `${y1}`);
            prime.setAttribute("x2", `${x2}`);
            prime.setAttribute("y2", `${y2}`);
        }
    }

    numArc(){
        switch(this.Mark){
            case AngleMark.rightAngle:
                return 0;
            case AngleMark.arc :
            case AngleMark.prime:
            case AngleMark.prime2:
            case AngleMark.prime3:
                return 1;
            case AngleMark.arc2:
                return 2;
            case AngleMark.arc3:
                return 3;
        }
    }

    numPrime(){
        switch(this.Mark){
            case AngleMark.rightAngle: return 2;
            case AngleMark.prime:   return 1;
            case AngleMark.prime2:  return 2;
            case AngleMark.prime3:  return 3;
            default:                return 0;
        }
    }

    processEvent =(sources: Shape[])=>{
        this.drawArc();
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        const line = getLine(ev);
        
        if(line != null){
            this.lines.push(line);

            this.downPos.push(pt);

            if(this.lines.length == 1){


                line.select(true);
            }
            else{

                // 交点
                const p = linesIntersection(this.lines[0], this.lines[1]);
                
                for(let [i, pt] of this.downPos.entries()){
                    const head_side = (0 < pt.sub(p).dot(this.lines[i].p12)  );
                    this.handleIdx.push(head_side ? 1 : 0);
                }       

                this.drawArc();
        
                for(let line2 of this.lines){

                    line2.listeners.push(this);
                }

                this.finishTool();
            }
        }
    }

    pointermove = (ev: PointerEvent) : void => {
    }
}


export class Label extends CompositeShape {
    Text: string = "ラベル";

    svgText: SVGTextElement;

    constructor(){
        super();

        this.svgText = document.createElementNS("http://www.w3.org/2000/svg","text");
        this.svgText.setAttribute("stroke", "navy");
    }

    makeObj() : any {
        return Object.assign(super.makeObj(), {
            Text: this.Text
        });
    }

    make(obj: any):ShapeWidget{
        super.make(obj);

        if(this.parentView.FlipY){
            
            this.svgText.setAttribute("transform", `matrix(1, 0, 0, -1, 0, 0)`);
        }

        const p = toSvgRatio();
        this.svgText.setAttribute("font-size", `${16 * p.y}`);
        this.svgText.setAttribute("stroke-width", `${0.2 * p.y}`);

        this.svgText.textContent = this.Text;

        if(this.handles.length != 0){

            this.svgText.setAttribute("x", "" + this.handles[0].pos.x);
            this.svgText.setAttribute("y", `${this.getY()}`);
        }

        this.parentView.G0.appendChild(this.svgText);

        return this;
    }

    propertyNames() : string[] {
        return [ "Text" ];
    }

    setText(text: string){
        this.Text = text;
        this.svgText.textContent = text;
    }

    *restore(){
        this.processEvent([this.handles[0]]);
    }

    getY() : number {
        if(this.parentView.FlipY){
            return - this.handles[0].pos.y;
        }
        else{

            return   this.handles[0].pos.y;
        }
    }

    processEvent =(sources: Shape[])=>{
        console.assert(sources.length == 1 && sources[0] == this.handles[0]);
        this.svgText.setAttribute("x", "" + this.handles[0].pos.x);
        this.svgText.setAttribute("y", `${this.getY()}`);
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        this.addHandle(clickHandle(ev, pt));

        this.svgText.setAttribute("x", "" + this.handles[0].pos.x);
        this.svgText.setAttribute("y", `${this.getY()}`);
        this.finishTool();
    }
}


export class Image extends CompositeShape {
    fileName: string = "";
    image: SVGImageElement;

    constructor(obj: any){
        super();
        super.make(obj);

        this.image = document.createElementNS("http://www.w3.org/2000/svg", "image") as SVGImageElement;

        if(this.parentView.FlipY){
            
            this.image.setAttribute("transform", `matrix(1, 0, 0, -1, 0, 0)`);
        }
        this.image.setAttribute("preserveAspectRatio", "none");
        // setSvgImg(this.image, this.fileName);
        this.image.setAttributeNS('http://www.w3.org/1999/xlink','href', this.fileName);

        this.parentView.G0.appendChild(this.image);

        setImageEventListener(this);
    }

    makeObj() : any {
        return Object.assign(super.makeObj(), {
            fileName: this.fileName
        });
    }

    load =(ev:Event)=>{

        let w: number;
        let h: number;

        if(this.handles.length == 2){

            w = Math.abs( this.handles[1].pos.x - this.handles[0].pos.x );
            h = Math.abs( this.handles[1].pos.y - this.handles[0].pos.y );
        }
        else{

            const rc = this.image.getBoundingClientRect();
            bansho.msg(`img loaded w:${rc.width} h:${rc.height}`);

            // 縦横比 = 縦 / 横
            const ratio = rc.height / rc.width;

            // viewBoxを得る。
            const vb = this.parentView.svg.viewBox.baseVal;

            // 縦横比を保って幅がsvgの半分になるようにする。
            w = vb.width / 2;
            h = ratio * vb.width / 2;
        }

        this.image.setAttribute("width", `${w}`);
        this.image.setAttribute("height", `${h}`);

        let pos = this.handles[0].pos;

        this.image.setAttribute("x", `${pos.x}`);
        this.image.setAttribute("y", `${this.getY() - h}`);

        if(this.handles.length == 1){

            this.addHandle(new Point({pos:new Vec2(pos.x + w, pos.y + h)}));
        }
    }

    getY() : number {
        if(this.parentView.FlipY){
            return - this.handles[0].pos.y;
        }
        else{

            return   this.handles[0].pos.y;
        }
    } 

    processEvent =(sources: Shape[])=>{
        for(let src of sources){
            if(src == this.handles[0]){

                let pos = this.handles[0].pos;

                let w = this.image.width.baseVal.value;
                let h = this.image.height.baseVal.value;

                this.image.setAttribute("x", `${pos.x}`);
                this.image.setAttribute("y", `${this.getY() - h}`);

                let pt1 = this.handles[1];
                pt1.pos.x = pos.x + w;
                pt1.pos.y = pos.y + h;
                pt1.setPos();
            }
            else if(src == this.handles[1]){
                let pt0 = this.handles[0];
                let pt1 = this.handles[1];

                const w = pt1.pos.x - pt0.pos.x;
                const h = pt1.pos.y - pt0.pos.y;

                this.image.setAttribute("y", `${this.getY() - h}`);                
                this.image.setAttribute("width", `${w}`);
                this.image.setAttribute("height", `${h}`);
            }
            else{
                console.assert(false);
            }
        }
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        this.addHandle(clickHandle(ev, pt));

        this.image.setAttribute("x", "" + this.handles[0].pos.x);
        this.image.setAttribute("y", "" + this.handles[0].pos.y);
        this.finishTool();
    }
}

}
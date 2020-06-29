namespace bansho{

const infinity = 20;
const strokeWidth = 4;
const thisStrokeWidth = 2;
const angleStrokeWidth = 2;
const angleRadius = 40;
const rightAngleLength = 20;
const gridLineWidth = 1;

declare let MathJax:any;

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

function lineArcIntersection(line:LineSegment, arc:CircleArc) : Vec2[] {
    // 円/弧の中心
    const center = arc.getCenter();

    // 円/弧の中心から線分に垂線をおろして、その足をfootとする。
    const foot = calcFootOfPerpendicular(center, line);

    // 円/弧の中心から垂線の足までの距離。
    const h = foot.sub(center).len();

    // 円/弧の半径
    let r = arc.getRadius();

    if(r < h ){
        // 半径が垂線の足までの距離より小さい場合

        return [];
    }

    // 垂線の足から交点までの距離
    let t = Math.sqrt(r*r - h * h);

    // 線分の単位方向ベクトル
    let e = line.e;
    
    // 交点の座標
    let p1 = foot.add(e.mul(t));
    let p2 = foot.add(e.mul(-t));

    return [p1, p2];
}

function ArcArcIntersection(arc1:CircleArc, arc2:CircleArc) : Vec2[] {
    // 円/弧の中心
    const c1 = arc1.getCenter();
    const c2 = arc2.getCenter();

    // 円/弧の半径
    const r1 = arc1.getRadius();
    const r2 = arc2.getRadius();

    // 円/弧の中心の距離
    const L = c1.dist(c2);

    // r1*r1 - t*t = r2*r2 - (L - t)*(L - t)
    //             = r2*r2 - L*L + 2Lt - t*t
    // r1*r1 = r2*r2 - L*L + 2Lt
    const t = (r1*r1 - r2*r2 + L*L)/ (2 * L);

    // 円/弧の交点から、円/弧の中心を結ぶ直線におろした垂線の長さの二乗
    const h2 = r1*r1 - t*t;
    if(h2 < 0){
        return [];
    }

    const h = Math.sqrt(h2);

    // c1→c2の単位ベクトル
    const e1 = c2.sub(c1).unit();

    // e1の法線ベクトル
    const e2 = new Vec2(- e1.y, e1.x);

    // 円/弧の交点から、円/弧の中心を結ぶ直線におろした垂線の足
    const foot = c1.add(e1.mul(t));
    
    // 交点の座標
    let p1 = foot.add(e2.mul(h));
    let p2 = foot.add(e2.mul(-h));

    return [p1, p2];
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
    glb.toolType = (document.querySelector('input[name="tool-type"]:checked') as HTMLInputElement).value;
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
        case "Arc":           return new Arc();
        case "DimensionLine": return new DimensionLine();
        case "Triangle":      return new Triangle();
        case "Midpoint":      return new Midpoint();
        case "Perpendicular": return new Perpendicular()
        case "ParallelLine":  return new ParallelLine()
        case "Intersection":  return new Intersection();
        case "Angle":         return new Angle();
        case "Image":         return new Image({fileName:"./img/teatime77.png"});
    } 
}

export function updateProperty(act: Widget){
    for(let [idx, name] of act.propertyNames().entries()){
        let value = act.getValue(name);

        let tr = glb.tblProperty.rows[idx];
        let valueTd = tr.cells[1];
        let inp = valueTd.firstElementChild;
        if(inp instanceof HTMLInputElement && inp.value != `${value}`){
            msg(`changed ${name} : ${inp.value} -> ${value}`)

            inp.value = value;
        }
    }
}

export function updateSummary(act: Widget){
    const idx = glb.widgets.indexOf(act);
    if(idx == -1){
        // トップレベルの図形でない場合
        return;
    }

    const opt = glb.selSummary.options[idx + 1];
    opt.innerHTML = act.summary();
}

export function showProperty(act: Widget){
    glb.tblProperty.innerHTML = "";

    for(let name of act.propertyNames()){

        const tr = document.createElement("tr");

        const nameTd = document.createElement("td");
        nameTd.innerText = name;

        const valueTd = document.createElement("td");

        let value = act.getValue(name);
        
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

        glb.tblProperty.appendChild(tr);
    }
}

export function deselectShape(){
    // 手前のウイジェット
    let prev_acts = glb.widgets.slice(0, getTimePos());

    // 手前の選択を無効にする。
    prev_acts.forEach(x => {
        if(x instanceof ShapeSelection){
            x.setEnable(false);
        }
    });
}

export function initDraw(){
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

    copy(){
        return new Vec2(this.x, this.y);
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

export class View extends Widget {
    div : HTMLDivElement;
    svg : SVGSVGElement;
    div2 : HTMLDivElement;
    defs : SVGDefsElement;
    gridBg : SVGRectElement;
    G0 : SVGGElement;
    G1 : SVGGElement;
    G2 : SVGGElement;
    CTMInv : DOMMatrix | null = null;
    svgRatio: number = 0;
    shapes: Shape[]= [];
    tool : Shape | null = null;
    eventQueue : EventQueue = new EventQueue();
    capture: Shape|null = null;
    AutoHeight: boolean = true;
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

    constructor(){
        super();
        glb.view = this;

        this.div = document.createElement("div");

        this.div.style.position = "relative";
        this.div.style.padding = "0px";
        this.div.style.zIndex = "1";
        this.div.style.backgroundColor = "cornsilk";
        this.div.style.cssFloat = "right";

        this.svg = document.createElementNS("http://www.w3.org/2000/svg","svg") as SVGSVGElement;

        this.svg.style.margin = "0px";

        this.svg.setAttribute("preserveAspectRatio", "none");
        //---------- 
        glb.board.appendChild(this.div);
        this.div.appendChild(this.svg);

        this.div2 = document.createElement("div");
        this.div2.style.position = "absolute";
        this.div2.style.left = "0px";
        this.div2.style.top = "0px";
        this.div2.style.backgroundColor = "transparent";
        this.div2.style.pointerEvents = "none";

        this.div.appendChild(this.div2);

        this.defs = document.createElementNS("http://www.w3.org/2000/svg","defs") as SVGDefsElement;
        this.svg.appendChild(this.defs);

        // グリッドの背景の矩形
        this.gridBg = document.createElementNS("http://www.w3.org/2000/svg","rect");
        this.svg.appendChild(this.gridBg);

        this.G0 = document.createElementNS("http://www.w3.org/2000/svg","g");
        this.G1 = document.createElementNS("http://www.w3.org/2000/svg","g");
        this.G2 = document.createElementNS("http://www.w3.org/2000/svg","g");
    
        this.svg.appendChild(this.G0);
        this.svg.appendChild(this.G1);
        this.svg.appendChild(this.G2);
    }

    make(obj: any) : Widget {
        console.assert(obj.Width != undefined && obj.Height != undefined && obj.ViewBox != undefined);
        super.make(obj);
        if(this.AutoHeight){
            this.calcHeight();
        }

        this.updateWidth();
        this.updateHeight();

        this.updateViewBox();
        this.setShowXAxis(this.ShowXAxis);
        this.setShowYAxis(this.ShowYAxis);

        this.xyAxis.forEach(x => { if(x != null){ x.updateRatio(); }});
    
        setViewEventListener(this);

        if(Glb.edit){

            setToolType();
        }

        return this;
    }

    all(v: Widget[]){
        super.all(v);
        this.xyAxis.filter(x => x != null).forEach(x => x!.all(v));
    }

    getTransform(){
        const f = 2 * this.svg.viewBox.baseVal.y + this.svg.viewBox.baseVal.height;
        return `matrix(1, 0, 0, -1, 0, ${f})`;
    }

    propertyNames() : string[] {
        return [ "Width", "Height", "AutoHeight", "ViewBox", "ShowGrid", "GridWidth", "GridHeight", "SnapToGrid", "FlipY", "ShowXAxis", "ShowYAxis" ];
    }

    makeObj() : any {
        return Object.assign(super.makeObj(), {
            "Width"    : this.Width,
            "Height"   : this.Height,
            "ViewBox"  : this.svg.getAttribute("viewBox"),
            "FlipY"    : this.FlipY,
            "ShowXAxis": this.ShowXAxis,
            "ShowYAxis": this.ShowYAxis,
            "xyAxis"   : this.xyAxis.map(x => (x == null ? null : x.toObj()))
        });
    }

    summary() : string {
        return "view";
    }

    setEnable(enable: boolean){
        super.setEnable(enable);
        this.div.style.visibility = (enable ? "visible" : "hidden");
    }

    setCTMInv(){
        const CTM = this.svg.getCTM()!;
        if(CTM != null){

            this.CTMInv = CTM.inverse();
        }

        const rc = this.svg.getBoundingClientRect() as DOMRect;
        this.svgRatio = this.svg.viewBox.baseVal.width / rc.width;

        msg(`\n${"-".repeat(10)} update Ratio ${"-".repeat(10)}\n`);
        this.allShapes().forEach(x => x.updateRatio());
    }

    calcHeight(){
        let [x1, y1, w, h] = this.parseViewBox1()
        this.Height = this.Width * h / w;
    }

    updateWidth(){
        this.div.style.width  = `${this.Width}px`;
        this.svg.style.width  = `${this.Width}px`;
        this.div2.style.width = `${this.Width}px`;
    }

    setWidth(value: number){
        this.Width = value;
        this.updateWidth();

        if(this.AutoHeight){
            this.calcHeight();
            this.updateHeight();
        }

        this.setCTMInv();
    }

    setAutoHeight(value: boolean){
        if(this.AutoHeight == value){
            return;
        }

        this.AutoHeight = value;
        if(this.AutoHeight){
            this.calcHeight();
            this.updateHeight();
            this.setCTMInv();
        }
    }

    setHeight(value: number){
        this.Height = value;
        this.updateHeight();
        this.setCTMInv();
    }

    updateHeight(){
        this.div.style.height  = `${this.Height}px`;
        this.svg.style.height  = `${this.Height}px`;
        this.div2.style.height = `${this.Height}px`;
    }

    parseViewBox1(){
        const v = this.ViewBox.split(' ').map(x => x.trim());
        console.assert(v.length == 4);

        const x1 = parseFloat(v[0]);
        const y1 = parseFloat(v[1]);
        const w  = parseFloat(v[2]);
        const h  = parseFloat(v[3]);

        return [x1, y1, w, h];
    }

    getViewBox() : string{
        let [x1, y1, w, h] = this.parseViewBox1()

        return `${x1}, ${y1}, ${x1 + w}, ${y1 + h}`;
    }

    parseViewBox2(value: string){
        const v = value.split(',').map(x => x.trim());
        console.assert(v.length == 4);
        const x1 = parseFloat(v[0]);
        const y1 = parseFloat(v[1]);
        const x2 = parseFloat(v[2]);
        const y2 = parseFloat(v[3]);

        return `${x1} ${y1} ${x2 - x1} ${y2 - y1}`;
    }

    setViewBox(value: string){
        this.ViewBox = this.parseViewBox2(value);
        this.updateViewBox();
    }

    updateViewBox(){
        if(this.AutoHeight){
            this.calcHeight();
            this.updateHeight();
        }

        this.svg.setAttribute("viewBox", this.ViewBox);

        this.setCTMInv();

        if(this.FlipY){
            
            const transform = this.getTransform();
            this.G0.setAttribute("transform", transform);
            this.G1.setAttribute("transform", transform);
            this.G2.setAttribute("transform", transform);
        }

        this.setGridPattern();
        if(! this.ShowGrid){
            this.gridBg.setAttribute("fill", "transparent");
        }
    }

    setShowGrid(value: boolean){
        if(this.ShowGrid == value){
            return;
        }

        this.ShowGrid = value;

        if(this.ShowGrid){
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

        if(show_axis){
            // 軸を表示する場合

            if(this.xyAxis[idx] == null){
                // 軸の線分がない場合

                if(idx == 0){
                    // X軸の場合

                    this.xyAxis[idx] = new LineSegment().makeByPos(-big_value, 0, big_value, 0);
                }
                else{
                    // Y軸の場合

                    this.xyAxis[idx] = new LineSegment().makeByPos(0, -big_value, 0, big_value);
                }
            }
            else{
                // 軸の線分がある場合

                this.xyAxis[idx]!.setColor("black")
            }    
        }
        else{
            // 軸を表示しない場合

            if(this.xyAxis[idx] != null){
                // 軸の線分がある場合

                this.xyAxis[idx]!.setColor("transparent")
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

        // グリッドの背景の矩形をviewBoxに合わせる。
        this.gridBg.setAttribute("x", `${vb.x}`);
        this.gridBg.setAttribute("y", `${vb.y}`);
        this.gridBg.setAttribute("width", `${vb.width}`);
        this.gridBg.setAttribute("height", `${vb.height}`);
    
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


    getSvgPoint(ev: MouseEvent | PointerEvent, draggedPoint: Point|null){

        const p = this.DomToSvgPos(ev.offsetX, ev.offsetY);
    
        if(this.SnapToGrid){
    
            const ele = document.elementFromPoint(ev.clientX, ev.clientY);
            if(ele == this.svg || ele == this.gridBg || (draggedPoint != null && ele == draggedPoint.circle)){
                p.x = Math.round(p.x / this.GridWidth ) * this.GridWidth;
                p.y = Math.round(p.y / this.GridHeight) * this.GridHeight;
            }
        }
    
        return new Vec2(p.x, p.y);
    }
    
    svgClick = (ev: MouseEvent)=>{
        glb.view = this;
        const pt1 = this.getSvgPoint(ev, null);
        if(this.capture != null){
            return;
        }
    
        if(ev.ctrlKey || glb.toolType == "select"){
    
            // for(let ele = ev.srcElement; obj; obj = ob)
            let clicked_shape : Shape|null = null;
            for(let shape of this.shapes.values()){
                if(Object.values(shape).includes(ev.srcElement)){
                    clicked_shape = shape;
                    break;
                }
                if(shape instanceof Angle && shape.svgElements().includes(ev.srcElement as any)){
                    clicked_shape = shape;
                    break;
                }
            }
    
            if(ev.ctrlKey){
                if(clicked_shape instanceof Point || clicked_shape instanceof LineSegment || clicked_shape instanceof Angle){
    
                    let act1 = glb.currentWidget();
                    if(act1 instanceof ShapeSelection){

                        act1.shapes.push(clicked_shape);
                        act1.enable();
                    }
                    else{

                        let act2 = new ShapeSelection();
                        act2.shapes.push(clicked_shape);
                
                        glb.addWidget(act2);
                    }
                }
            }
            else{
                
                if(clicked_shape == null){
                    showProperty(this);
                }
                else{
                    showProperty(clicked_shape);
                }    
            }
            
            return;
        }
    
        const pt = this.getSvgPoint(ev, null);
    
        if(this.tool == null){
            this.tool = makeToolByType(glb.toolType)!;
            console.assert(this.tool.getTypeName() == glb.toolType.split('.')[0]);
        }
    
        if(this.tool != null){
    
            this.tool.click(ev, pt);
        }
    }


    svgPointermove = (ev: PointerEvent)=>{
        if(this.capture != null){
            return;
        }
    
        if(this.tool != null){
            this.tool.pointermove(ev);
        }
    }
    
    getPoint(ev: MouseEvent) : Point | null{
        const pt = this.shapes.find(x => x.constructor.name == "Point" && (x as Point).circle == ev.target) as (Point|undefined);
        return pt == undefined ? null : pt;
    }
    
    getLine(ev: MouseEvent) : LineSegment | null{
        const line = this.shapes.find(x => x instanceof LineSegment && x.line == ev.target && x.handles.length == 2) as (LineSegment|undefined);
        return line == undefined ? null : line;
    }
    
    getCircle(ev: MouseEvent) : Circle | null{
        const circle = this.shapes.find(x => x instanceof Circle && x.circle == ev.target && x.handles.length == 2) as (Circle|undefined);
        return circle == undefined ? null : circle;
    }
    
    getArc(ev: MouseEvent) : Arc | null{
        const arc = this.shapes.find(x => x instanceof Arc && x.arc == ev.target && x.handles.length == 3) as (Arc|undefined);
        return arc == undefined ? null : arc;
    }

    toSvg2(x:number) : number{
        return x * this.svgRatio;
    }

    toSvgRatio() : Vec2 {
        const rc1 = this.svg.getBoundingClientRect() as DOMRect;
        const rc2 = this.div.getBoundingClientRect() as DOMRect;
    
        console.assert(rc1.x == rc2.x && rc1.y == rc2.y && rc1.width == rc2.width && rc1.height == rc2.height);
    
        return new Vec2(this.svg.viewBox.baseVal.width / rc1.width, this.svg.viewBox.baseVal.height / rc1.height) ;
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

    allShapes() : Shape[] {
        return getAll().filter(x => x instanceof Shape && x.parentView == this) as Shape[];
    }
}

export abstract class Shape extends Widget {
    parentView : View;
    selected: boolean = false;

    Name: string = "";
    namePos = new Vec2(0,0);
    svgName: SVGTextElement | null = null;

    Caption: string = "";
    captionPos = new Vec2(0, 0);
    divCaption : HTMLDivElement | null = null;

    processEvent(sources: Shape[]){}
    listeners:Shape[] = [];     //!!! リネーム注意 !!!

    select(selected: boolean){
        this.selected = selected;
    }

    click =(ev: MouseEvent, pt:Vec2): void => {}
    pointermove = (ev: PointerEvent) : void => {}

    constructor(){
        super();

        this.parentView = glb.view!;
        this.parentView.shapes.push(this);
    }

    makeObj() : any {
        let obj = Object.assign(super.makeObj(), {
            parentView : this.parentView.toObj()
        });

        if(this.Name != ""){
            obj.Name    = this.Name;
            obj.namePos = this.namePos;
        }

        if(this.Caption != ""){
            obj.Caption    = this.Caption;
            obj.captionPos = this.captionPos;
        }

        if(this.listeners.length != 0){
            obj.listeners = this.listeners.map(x => ({ ref: x.id }) );
        }

        return obj;
    }

    make(obj: any) : Widget {
        super.make(obj);
        this.updateName();
        this.updateCaption();

        return this;
    }

    summary() : string {
        if(this.Name != ""){
            return this.Name;
        }

        if(this.Caption != ""){
            return this.Caption.replace(/\$\$/g, "\n$$\n");
        }

        return "";
    }

    setEnable(enable: boolean){
        super.setEnable(enable);
        if(this.svgName != null){
            this.svgName.setAttribute("visibility", (enable ? "visible" : "hidden"));
        }

        if(this.divCaption != null){
            this.divCaption.style.visibility = (enable ? "visible" : "hidden");
        }
    }

    delete(){
        super.delete();

        if(this.svgName != null){
            this.svgName.parentElement!.removeChild(this.svgName);
        }

        if(this.divCaption != null){
            this.divCaption.parentElement!.removeChild(this.divCaption);
        }
    }

    finishTool(){
        this.parentView.G0toG1();
    
        let selected_shapes = this.parentView.allShapes().filter(x => x.selected);
        selected_shapes.forEach(x => x.select(false));
    
        console.assert(this.parentView.tool != null);
        glb.addWidget(this.parentView.tool!);
        this.parentView.tool = null;
    }

    addListener(shape: Shape){
        console.assert(shape instanceof Shape);
        this.listeners.push(shape);
    }

    bind(pt: Point){
        this.addListener(pt);
        pt.bindTo = this;
    }

    makeEventGraph(src:Shape|null){
        // イベントのリスナーに対し
        for(let shape of this.listeners){
            if(!(shape instanceof Shape)){
                // !!!!!!!!!! ERROR !!!!!!!!!!
                // msg(`this:${this.id} shape:${(shape as any).id} ${(shape as Widget).summary()}`);
                continue;
            }
            
            // ビューのイベントキューのイベントグラフに追加する。
            this.parentView.eventQueue.addEventMakeEventGraph(shape, this);
        }
    }

    toSvg(x:number) : number{
        return x * this.parentView.svgRatio;
    }

    updateRatio(){
        if(this.svgName != null){
            const p = this.parentView.toSvgRatio();
            this.svgName.setAttribute("font-size", `${16 * p.y}`);
            this.svgName.setAttribute("stroke-width", `${0.2 * p.y}`);
        }
    }

    setName(text: string){
        this.Name = text;
        this.updateName();
    }

    setCaption(text: string){
        this.Caption = text;
        this.updateCaption();
    }

    updateName(){
        if(this.Name == ""){
            if(this.svgName != null){

                this.svgName.removeEventListener("pointerdown", this.namePointerdown);
                this.svgName.removeEventListener("pointermove", this.namePointermove);
                this.svgName.removeEventListener("pointerup"  , this.namePointerup);

                this.svgName.parentElement!.removeChild(this.svgName);
                this.svgName = null;
            }
        }
        else{
            if(this.svgName == null){

                this.svgName = document.createElementNS("http://www.w3.org/2000/svg","text");
                this.svgName.setAttribute("stroke", "navy");
                this.svgName.style.cursor = "pointer";
                this.parentView.G0.appendChild(this.svgName);

                if(this.parentView.FlipY){            
                    this.svgName.setAttribute("transform", `matrix(1, 0, 0, -1, 0, 0)`);
                }

                this.updateNamePos();
                this.updateRatio();
        
                setNameEventListener(this);
            }

            this.svgName.textContent = this.Name;
        }
    }

    updateCaption(){
        if(this.Caption == ""){

            if(this.divCaption != null){
                
                this.divCaption.removeEventListener("pointerdown", this.captionPointerdown);
                this.divCaption.removeEventListener("pointermove", this.captionPointermove);
                this.divCaption.removeEventListener("pointerup"  , this.captionPointerup);

                this.divCaption.parentElement!.removeChild(this.divCaption);
                this.divCaption = null;
            }
        }
        else{

            if(this.divCaption == null){

                this.divCaption = document.createElement("div");
                this.divCaption.style.position = "absolute";
                this.divCaption.style.backgroundColor = "transparent";
                this.divCaption.style.cursor = "move";
                this.divCaption.style.pointerEvents = "all";
        
                this.parentView.div2.appendChild(this.divCaption);

                this.updateCaptionPos();

                setCaptionEventListener(this);
            }

            this.divCaption.textContent = "$$\n" + this.Caption + "\$$";

            MathJax.typesetPromise([this.divCaption]);
        }
    }

    namePointerdown =(ev: PointerEvent)=>{
        if(glb.toolType != "select"){
            return;
        }

        glb.eventPos = this.parentView.DomToSvgPos(ev.offsetX, ev.offsetY);
        this.parentView.capture = this;
        this.svgName!.setPointerCapture(ev.pointerId);
    }

    namePointermove =(ev: PointerEvent)=>{
        if(glb.toolType != "select" || this.parentView.capture != this){
            return;
        }
        
        this.setNamePos(ev);
    }

    namePointerup =(ev: PointerEvent)=>{
        if(glb.toolType != "select"){
            return;
        }

        this.svgName!.releasePointerCapture(ev.pointerId);
        this.parentView.capture = null;

        this.setNamePos(ev);
    }

    captionPointerdown =(ev: PointerEvent)=>{
        if(glb.toolType != "select"){
            return;
        }

        glb.eventPos = new Vec2(ev.screenX, ev.screenY);
        glb.orgPos   = this.captionPos.copy();

        this.parentView.capture = this;
        this.divCaption!.setPointerCapture(ev.pointerId);
    }

    captionPointermove =(ev: PointerEvent)=>{
        if(glb.toolType != "select" || this.parentView.capture != this){
            return;
        }
        
        this.setCaptionPos(ev);
    }

    captionPointerup =(ev: PointerEvent)=>{
        if(glb.toolType != "select"){
            return;
        }

        this.divCaption!.releasePointerCapture(ev.pointerId);
        this.parentView.capture = null;

        this.setCaptionPos(ev);
    }

    getNameXY(){
        console.assert(false);
        return [0, 0];
    }

    getCaptionXY(){
        console.assert(false);
        return [0, 0];
    }

    setNamePos(ev: MouseEvent | PointerEvent){
        let pos = this.parentView.DomToSvgPos(ev.offsetX, ev.offsetY);

        this.namePos.x += pos.x - glb.eventPos.x;
        this.namePos.y += pos.y - glb.eventPos.y;
        glb.eventPos = pos;

        this.updateNamePos();
    }

    updateNamePos(){
        if(this.svgName != null){

            let [x, y] = this.getNameXY();
            this.svgName.setAttribute("x", `${x}`);
            this.svgName.setAttribute("y", `${y}`);
        }
    }

    setCaptionPos(ev: MouseEvent | PointerEvent){
        this.captionPos.x = glb.orgPos.x + (ev.screenX - glb.eventPos.x);
        this.captionPos.y = glb.orgPos.y + (ev.screenY - glb.eventPos.y);

        this.updateCaptionPos();
    }

    updateCaptionPos(){
        if(this.divCaption != null){

            let [x, y] = this.getCaptionXY();
            this.divCaption.style.left  = `${x}px`;
            this.divCaption.style.top   = `${y}px`;
        }
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

            handle.addListener(this);
        }
        this.handles.push(handle);
    }

    makeObj() : any {
        return Object.assign(super.makeObj() , {
            handles : this.handles.map(x => x.toObj())
        });
    }

    delete(){
        super.delete();
        for(let x of this.handles){
            x.delete();
        }
    }

    summary() : string {
        const text = super.summary();
        if(text != ""){
            return text;
        }

        return this.handles.map(x => x.summary()).join(' ');
    }

    setEnable(enable: boolean){
        super.setEnable(enable);
        this.handles.forEach(x => x.setEnable(enable));
    }

    clickHandle(ev: MouseEvent, pt:Vec2) : Point{
        let handle = this.parentView.getPoint(ev);
        if(handle == null){
    
            const line = this.parentView.getLine(ev);
            if(line != null){
    
                handle = new Point({pos:pt});
                line.adjust(handle);
    
                line.bind(handle)
            }
            else{
                const circle = this.parentView.getCircle(ev);
                if(circle != null){
    
                    handle = new Point({pos:pt});
                    circle.adjust(handle);
    
                    circle.bind(handle)
                }
                else{
                    const arc = this.parentView.getArc(ev);
                    if(arc != null){

                        handle = new Point({pos:pt});
                        arc.adjust(handle);
                        arc.bind(handle)    
                    }
                    else{

                        handle = new Point({pos:pt});
                    }
                }
            }
        }
        else{
            handle.select(true);
        }
    
        return handle;
    }
}

export class Point extends Shape {
    pos : Vec2 = new Vec2(NaN, NaN);
    bindTo: Shape|undefined;    //!!! リネーム注意 !!!

    circle : SVGCircleElement;

    constructor(obj: any){
        super();

        this.circle = document.createElementNS("http://www.w3.org/2000/svg","circle");
        this.circle.setAttribute("fill", "blue");        
        this.circle.style.cursor = "pointer";

        console.assert(obj.pos != undefined);
        super.make(obj);
        console.assert(! isNaN(this.pos.x));

        setPointEventListener(this);

        this.updateName();
        this.updateCaption();

        this.updateRatio();

        this.setPos();
    
        this.parentView.G2.appendChild(this.circle);

        return this;
    }

    setEnable(enable: boolean){
        super.setEnable(enable);
        this.circle.setAttribute("visibility", (enable ? "visible" : "hidden"));
    }

    updateRatio(){
        super.updateRatio();
        this.circle.setAttribute("r", `${this.toSvg(5)}`);
    }

    propertyNames() : string[] {
        return [ "X", "Y", "Name", "Caption" ];
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
        return `点 ${super.summary()}`;
    }

    getX(){
        return this.pos.x;
    }

    setX(value:any){
        this.pos.x =  parseFloat(value);
        this.updatePos();
    }

    getY(){
        return this.pos.y;
    }

    setY(value:any){
        this.pos.y =  parseFloat(value);
        this.updatePos();
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        this.pos = pt;

        const line = this.parentView.getLine(ev);

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

        this.updateNamePos();
        this.updateCaptionPos();
    }

    getNameXY(){
        let x = this.pos.x + this.namePos.x;
        let y = this.pos.y + this.namePos.y;

        if(this.parentView.FlipY){
            return [x, - y];
        }
        else{

            return [x, y];
        }
    }


    getCaptionXY(){
        let p = this.parentView.SvgToDomPos(this.pos);

        return [p.x + this.captionPos.x, p.y + this.captionPos.y];
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

    private dragPoint(){
        if(this.bindTo != undefined){

            if(this.bindTo instanceof LineSegment){
                this.bindTo.adjust(this);
            }
            else if(this.bindTo instanceof Circle){
                this.bindTo.adjust(this);
            }
            else if(this.bindTo instanceof Arc){
                this.bindTo.adjust(this);
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

            if(this.bindTo instanceof LineSegment || this.bindTo instanceof Circle || this.bindTo instanceof Arc){
                this.bindTo.adjust(this);
            }
        }
    }

    updatePos(){
        this.dragPoint();
        this.makeEventGraph(null);
        this.parentView.eventQueue.processQueue();
    }

    pointerdown =(ev: PointerEvent)=>{
        if(glb.toolType != "select"){
            return;
        }

        this.parentView.capture = this;
        this.circle.setPointerCapture(ev.pointerId);
    }

    pointermove =(ev: PointerEvent)=>{
        if(glb.toolType != "select"){
            return;
        }

        if(this.parentView.capture != this){
            return;
        }

        this.pos = this.parentView.getSvgPoint(ev, this);
        
        this.updatePos();
    }

    pointerup =(ev: PointerEvent)=>{
        if(glb.toolType != "select"){
            return;
        }

        this.circle.releasePointerCapture(ev.pointerId);
        this.parentView.capture = null;

        this.pos = this.parentView.getSvgPoint(ev, this);
        this.updatePos();
    }

    delete(){
        super.delete();
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
    Color: string = "navy";

    Arrow = 0;
    svgArrow : SVGPathElement | null = null;

    constructor(){
        super();
        //---------- 
        this.line = document.createElementNS("http://www.w3.org/2000/svg","line");
        this.line.setAttribute("stroke", this.Color);
        this.updateRatio();

        this.parentView.G0.appendChild(this.line);
    }

    makeObj() : any {
        let obj = Object.assign(super.makeObj(), {
            "Color"    : this.Color
        });

        if(this.Arrow != 0){
            obj.Arrow = this.Arrow;
        }

        return obj;
    }

    summary() : string {
        return `線分 ${super.summary()}`;
    }

    setEnable(enable: boolean){
        super.setEnable(enable);
        this.line.setAttribute("visibility", (enable ? "visible" : "hidden"));
    }

    updateRatio(){
        super.updateRatio();
        this.line.setAttribute("stroke-width", `${this.toSvg(strokeWidth)}`);
    }

    make(obj: any) : Widget {
        super.make(obj);
        for(let p of this.handles){
            console.assert(!isNaN(p.pos.x))
        }

        this.updateRatio();

        this.setVecs();
        this.updateArrow();
        this.updateLinePos();
        this.line.style.cursor = "move";

        return this;
    }

    getNameXY(){
        const p1 = this.handles[0].pos;
        const p2 = this.handles[1].pos;

        const p = new Vec2((p1.x + p2.x)/2, (p1.y + p2.y)/2);

        let x = p.x + this.namePos.x;
        let y = p.y + this.namePos.y;

        if(this.parentView.FlipY){
            return [x, - y];
        }
        else{

            return [x, y];
        }
    }

    makeByPos(x1: number, y1: number, x2: number, y2: number){
        this.line.style.cursor = "move";
        this.addHandle(new Point({pos:new Vec2(x1, y1)}));
        this.addHandle(new Point({pos:new Vec2(x2, y2)}));
        this.updateLinePos();

        return this;
    }

    propertyNames() : string[] {
        return [ "Color", "Name", "Arrow" ];
    }

    setColor(c:string){
        this.Color = c;
        this.line.setAttribute("stroke", c);
    }

    setArrow(n: number){
        this.Arrow = n;
        this.updateArrow();
    }

    updateArrow(){
        if(this.Arrow == 0){
            if(this.svgArrow != null){

                this.svgArrow.parentElement!.removeChild(this.svgArrow);
                this.svgArrow = null;
            }
        }
        else{

            if(this.svgArrow == null){
                this.svgArrow = document.createElementNS("http://www.w3.org/2000/svg","path");
                this.svgArrow.setAttribute("fill", this.Color);

                this.parentView.G0.appendChild(this.svgArrow);

                this.updateArrowPos();
            }
        }
    }

    updateArrowPos(){
        if(this.svgArrow != null){
            let p1 = this.handles[1].pos;

            let sz = this.toSvg(10);
            let n = new Vec2(this.e.y, - this.e.x);

            let a1 = p1.add(this.e.mul( sz));
            let a2 = p1.add(this.e.mul(-sz));

            let b1 = a2.add(n.mul( sz));
            let b2 = a2.add(n.mul(-sz));

            let d = `M${a1.x} ${a1.y} L${b1.x} ${b1.y} L${b2.x} ${b2.y} Z`;
            this.svgArrow.setAttribute("d", d);
        }
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

    updateLinePos(){
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

        this.updateNamePos();
        this.updateArrowPos();
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        this.addHandle(this.clickHandle(ev, pt));

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
        const pt = this.parentView.getSvgPoint(ev, null);

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
        this.addHandle(this.clickHandle(ev, pt));

        this.points.push( this.parentView.getSvgPoint(ev, null) );

        if(this.handles.length == 2){

            bansho.msg(`b-spline ${this.points.length}`);
            this.drawPath();
            this.finishTool();
        }
    }

    pointermove =(ev: PointerEvent) : void =>{
        const pt = this.parentView.getSvgPoint(ev, null);

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

export class Polygon extends CompositeShape {
    lines : Array<LineSegment> = [];

    all(v: Widget[]){
        super.all(v);
        this.lines.forEach(x => x.all(v));
    }

    setEnable(enable: boolean){
        super.setEnable(enable);
        this.lines.forEach(x => x.setEnable(enable));
    }
}

export class Rect extends Polygon {
    isSquare: boolean = true;
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

    summary() : string {
        return this.isSquare ? "正方形" : "矩形";
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
                
                this.addHandle(new Point({pos:p3}), false);
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
                this.addHandle(handle4, false);

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

        this.addHandle(this.clickHandle(ev, pt));

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
        const pt = this.parentView.getSvgPoint(ev, null);

        this.setRectPos(pt, -1, false);
    }
}

class CircleArc extends CompositeShape {
    Color: string = "navy";

    getRadius(){
        return NaN;
    }

    getCenter(){
        return this.handles[0].pos;
    }
}

export class Circle extends CircleArc {
    byDiameter:boolean;
    center: Vec2|null = null;
    radius: number = this.toSvg(1);
    
    circle: SVGCircleElement;

    constructor(by_diameter: boolean){
        super();

        this.byDiameter = by_diameter;

        this.circle = document.createElementNS("http://www.w3.org/2000/svg","circle");
        this.circle.setAttribute("fill", "none");// "transparent");
        this.circle.setAttribute("stroke", this.Color);
        this.circle.setAttribute("fill-opacity", "0");
        this.circle.style.cursor = "move";

        this.updateRatio();
        
        this.parentView.G0.appendChild(this.circle);    
    }

    summary() : string {
        return "円";
    }

    setEnable(enable: boolean){
        super.setEnable(enable);
        this.circle.setAttribute("visibility", (enable ? "visible" : "hidden"));
    }

    updateRatio(){
        super.updateRatio();
        this.circle.setAttribute("stroke-width", `${this.toSvg(strokeWidth)}`);
    }

    makeObj() : any {
        return Object.assign(super.makeObj(), {
            byDiameter: this.byDiameter,
            center: this.center,
            radius: this.radius,
            Color : this.Color
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

    select(selected: boolean){
        if(this.selected != selected){
            this.selected = selected;

            if(this.selected){
                this.circle.setAttribute("stroke", "orange");
            }
            else{
                this.circle.setAttribute("stroke", this.Color);
            }
        }
    }

    setColor(c:string){
        this.Color = c;
        this.circle.setAttribute("stroke", this.Color);
    }

    setCenter(pt: Vec2){
        this.center = this.handles[0].pos.add(pt).mul(0.5);

        this.circle.setAttribute("cx", "" + this.center.x);
        this.circle.setAttribute("cy", "" + this.center.y);
    }

    getRadius(){
        return this.radius;
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
        this.addHandle(this.clickHandle(ev, pt));

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
    
            this.finishTool();
        }
    }

    pointermove =(ev: PointerEvent) : void =>{
        const pt = this.parentView.getSvgPoint(ev, null);

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
            arc.setAttribute("stroke", "navy");
            arc.style.cursor = "pointer";
            arc.style.zIndex = "-2";

            this.parentView.G0.appendChild(arc);

            this.arcs.push(arc);

            const line = document.createElementNS("http://www.w3.org/2000/svg","line");
            line.setAttribute("stroke", "navy");
    
            this.parentView.G0.appendChild(line);
    
            this.lines.push(line);
        }

        this.updateRatio();
    }

    summary() : string {
        return "寸法線";
    }

    setEnable(enable: boolean){
        super.setEnable(enable);

        const visibility = (enable ? "visible" : "hidden");
        this.arcs.forEach(x => x.setAttribute("visibility", visibility));
        this.lines.forEach(x => x.setAttribute("visibility", visibility));
    }

    updateRatio(){
        super.updateRatio();
        for(let arc of this.arcs){
            arc.setAttribute("stroke-width", `${this.toSvg(thisStrokeWidth)}`);
        }
        for(let line of this.lines){
            line.setAttribute("stroke-width", `${this.toSvg(thisStrokeWidth)}`);
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
        this.addHandle(this.clickHandle(ev, pt));

        if(this.handles.length == 3){
    
            this.finishTool();
        }
    }

    pointermove =(ev: PointerEvent) : void =>{
        if(this.handles.length != 2){
            return;
        }

        this.drawPath(this.parentView.getSvgPoint(ev, null));
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

            this.lines.forEach(x => x.setAttribute("visibility", "visible"));
        }
        else{
            this.lines.forEach(x => x.setAttribute("visibility", "hidden") );
        }

    }
}

export class Triangle extends Polygon {
    makeObj() : any {
        return Object.assign(super.makeObj(), {
            lines: this.lines.map(x => x.toObj()) 
        });
    }

    summary() : string {
        return "三角形";
    }

    click =(ev: MouseEvent, pt:Vec2): void =>{
        const line = new LineSegment();

        if(this.lines.length == 0){
            line.addHandle(this.clickHandle(ev, pt));
        }
        else{

            const lastLine = last(this.lines);
            const handle = this.clickHandle(ev, pt);
            lastLine.addHandle(handle);
            lastLine.updateLinePos();
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
        line.updateLinePos();
    }

    pointermove =(ev: PointerEvent) : void =>{
        const lastLine = last(this.lines);
        lastLine.pointermove(ev);
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

    summary() : string {
        return "中点";
    }

    setEnable(enable: boolean){
        super.setEnable(enable);
        this.midpoint!.setEnable(enable);
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
        this.addHandle(this.clickHandle(ev, pt));

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
        this.foot!.all(v);
        this.perpendicular!.all(v);
    }

    summary() : string {
        return "垂線";
    }

    setEnable(enable: boolean){
        super.setEnable(enable);

        this.foot!.setEnable(enable);
        this.perpendicular!.setEnable(enable);
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

            this.addHandle(this.clickHandle(ev, pt));
        }
        else {

            this.line = this.parentView.getLine(ev);
            if(this.line == null){
                return;
            }

            this.line.addListener(this);

            this.foot = new Point({pos:calcFootOfPerpendicular(this.handles[0].pos, this.line!)});

            this.perpendicular = new LineSegment();
            this.perpendicular.line.style.cursor = "move";
            this.perpendicular.addHandle(this.handles[0]);
            this.perpendicular.addHandle(this.foot, false);

            this.perpendicular.setVecs();
            this.perpendicular.updateLinePos();

            this.finishTool();
        }
    }
}

export class ParallelLine extends CompositeShape {
    line1 : LineSegment | null = null;
    line2 : LineSegment | null = null;

    all(v: Widget[]){
        super.all(v);
        this.line1!.all(v);
        this.line2!.all(v);
    }
    
    makeObj() : any {
        return Object.assign(super.makeObj(), {
            line1: this.line1!.toObj(),
            line2: this.line2!.toObj(),
        });
    }

    summary() : string {
        return "平行線";
    }

    setEnable(enable: boolean){
        super.setEnable(enable);
        
        this.line2!.setEnable(enable);
    }

    calcParallelLine(){
        let pos = this.handles[0].pos;
        const p1 = pos.add(this.line1!.e.mul(infinity));
        const p2 = pos.sub(this.line1!.e.mul(infinity));

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

            this.line1 = this.parentView.getLine(ev);
            if(this.line1 == null){
                return;
            }

            this.line1.select(true);
            this.line1.addListener(this);
        }
        else {

            let point = this.parentView.getPoint(ev);
            if(point == null){
                return;
            }

            this.addHandle(point);

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

export class Intersection extends Shape {
    lines : LineSegment[] = [];
    arcs    : CircleArc[] = [];
    intersections : Point[] = [];

    makeObj() : any {
        let obj = Object.assign(super.makeObj(), {
            lines: this.lines.map(x => x.toObj()),
            arcs : this.arcs.map(x => x.toObj()),
            intersections: this.intersections.map(x => x.toObj())
        });

        return obj;
    }

    all(v: Widget[]){
        super.all(v);
        this.intersections.forEach(x => x.all(v));
    }

    summary() : string {
        return "交点";
    }

    setEnable(enable: boolean){
        super.setEnable(enable);
        
        this.intersections.forEach(x => x.setEnable(enable));
    }

    makeEventGraph(src:Shape|null){
        super.makeEventGraph(src);

        for(let pt of this.intersections){
            this.parentView.eventQueue.addEventMakeEventGraph(pt, this);
        }
    }

    processEvent =(sources: Shape[])=>{
        let points : Vec2[] = [];

        if(this.lines.length == 2){
            points.push( linesIntersection(this.lines[0], this.lines[1]) );
        }
        else if(this.lines.length == 1 && this.arcs.length == 1){
            points = lineArcIntersection(this.lines[0], this.arcs[0]);
        }
        else if(this.arcs.length == 2){
            points = ArcArcIntersection(this.arcs[0], this.arcs[1]);
        }

        for(let [i,pt] of points.entries()){
            this.intersections[i].pos = pt;
            this.intersections[i].setPos();
        }
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        const line = this.parentView.getLine(ev);
        
        if(line != null){
            this.lines.push(line);

            if(this.lines.length == 1){

                line.select(true);
            }
        }
        else{
            const circle = this.parentView.getCircle(ev);
            if(circle != null){

                this.arcs.push(circle);
                circle.select(true);
            }
            else{
                const arc = this.parentView.getArc(ev);
                if(arc != null){

                    this.arcs.push(arc);
                    arc.select(true);
                }
            }    
        }

        if(this.lines.length == 2){
            const v = linesIntersection(this.lines[0], this.lines[1]);
            this.intersections.push(new Point({pos:v}));
        }
        else if(this.lines.length == 1 && this.arcs.length == 1){

            let points = lineArcIntersection(this.lines[0], this.arcs[0]);

            if(points.length != 0){

                points.forEach(p => this.intersections.push(new Point({pos:p})));
            }
        }
        else if(this.arcs.length == 2){

            let points = ArcArcIntersection(this.arcs[0], this.arcs[1]);

            if(points.length != 0){

                points.forEach(p => this.intersections.push(new Point({pos:p})));
            }
        }

        if(this.lines.length + this.arcs.length == 2){
            this.lines.forEach(x => x.addListener(this));
            this.arcs.forEach(x => x.addListener(this));

            this.finishTool();
        }
    }

    pointermove = (ev: PointerEvent) : void => {
    }
}

function calcLargeArcSweepFlag(q1: Vec2, q2: Vec2){
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

        return [ theta1, theta2, deltaTheta, largeArcSweepFlag];
}

export class Arc extends CircleArc {
    arc   : SVGPathElement;

    constructor(){
        super();
        this.arc = document.createElementNS("http://www.w3.org/2000/svg","path");

        this.arc.setAttribute("fill", "none");
        this.arc.setAttribute("stroke", this.Color);
        this.arc.setAttribute("stroke-width", `${this.toSvg(strokeWidth)}`);
        this.arc.style.cursor = "pointer";

        this.parentView.G0.appendChild(this.arc);
    }

    makeObj() : any {
        return Object.assign(super.makeObj(), {
            Color : this.Color
        });
    }

    make(obj: any) : Widget {
        super.make(obj);
        this.drawArc(null);

        return this;
    }

    summary() : string {
        return "弧";
    }

    propertyNames() : string[] {
        return [ "Color" ];
    }

    select(selected: boolean){
        if(this.selected != selected){
            this.selected = selected;

            if(this.selected){
                this.arc.setAttribute("stroke", "orange");
            }
            else{
                this.arc.setAttribute("stroke", this.Color);
            }
        }
    }

    setColor(c:string){
        this.Color = c;

        this.arc.setAttribute("stroke", this.Color);
    }

    setEnable(enable: boolean){
        super.setEnable(enable);
        this.arc.setAttribute("visibility", (enable ? "visible" : "hidden"));
    }

    processEvent =(sources: Shape[])=>{
        this.drawArc(null);
    }

    getRadius(){
        let [p0, p1] = [ this.handles[0].pos, this.handles[1].pos ];
        return p1.sub(p0).len();
    }

    adjust(handle: Point) {
        let [p0, p1] = [ this.handles[0].pos, this.handles[1].pos ];
        let radius = this.getRadius();

        const v = handle.pos.sub(p0);
        const theta = Math.atan2(v.y, v.x);

        handle.pos = new Vec2(p0.x + radius * Math.cos(theta), p0.y + radius * Math.sin(theta));

        handle.setPos();
    }

    click =(ev: MouseEvent, pt:Vec2): void =>{
        this.addHandle(this.clickHandle(ev, pt));

        if(this.handles.length == 3){
            this.drawArc(null);

            this.finishTool();
        }
    }

    drawArc(pt: Vec2 | null){
        let [p0, p1] = [ this.handles[0].pos, this.handles[1].pos ];
        let p2 = (pt != null ? pt : this.handles[2].pos);

        const q1 = p1.sub(p0);
        const q2 = p2.sub(p0);

        let [ theta1, theta2, deltaTheta, largeArcSweepFlag] = calcLargeArcSweepFlag(q1, q2);

        let r = this.getRadius();

        let x = p0.x + r * Math.cos(theta2);
        let y = p0.y + r * Math.sin(theta2);

        const d = `M${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArcSweepFlag} 1 ${x} ${y}`;

        this.arc.setAttribute("d", d);

        if(this.handles.length == 3){

            this.handles[2].pos = new Vec2(x, y);
            this.handles[2].setPos();
        }
    }

    pointermove =(ev: PointerEvent) : void =>{
        const pt = this.parentView.getSvgPoint(ev, null);

        if(this.handles.length == 2){

            this.drawArc(pt);
        }
    }

    delete(){
        super.delete();
        this.arc.parentElement!.removeChild(this.arc);
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

export class Angle extends Shape {
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
        this.updateRatio();

        this.drawAngleArc();

        return this;
    }

    svgElements(){
        return (this.arcs as SVGGraphicsElement[]).concat(this.primes)
    }

    propertyNames() : string[] {
        return [ "Mark", "Color", "Name" ];
    }

    summary() : string {
        return "角度";
    }

    setEnable(enable: boolean){
        super.setEnable(enable);
        this.svgElements().forEach(x => x.setAttribute("visibility", (enable ? "visible" : "hidden")));
    }

    delete(){        
        super.delete();
        this.svgElements().forEach(x => x.parentElement!.removeChild(x));
    }

    setMark(mark: AngleMark){
        this.Mark = mark;
        msg(`mark:${mark}`);

        this.drawAngleArc();
    }

    setColor(c:string){
        this.Color = c;
        for(let arc of this.arcs){

            arc.setAttribute("stroke", c);
        }
    }

    select(selected: boolean){
        if(this.selected != selected){
            this.selected = selected;

            let color = (this.selected ? "orange" : this.Color);
            this.svgElements().forEach(x => x.setAttribute("stroke", color));
        }
    }

    updateRatio(){
        super.updateRatio();
        for(let arc of this.arcs){
            arc.setAttribute("stroke-width", `${this.toSvg(angleStrokeWidth)}`);
        }
        for(let prime of this.primes){
            prime.setAttribute("stroke-width", `${this.toSvg(angleStrokeWidth)}`);
        }
    }

    getNameXY(){
        // 交点
        const p = linesIntersection(this.lines[0], this.lines[1]);

        let x = p.x + this.namePos.x;
        let y = p.y + this.namePos.y;

        if(this.parentView.FlipY){
            return [x, - y];
        }
        else{

            return [x, y];
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
            prime.setAttribute("stroke", this.Color);
            prime.setAttribute("stroke-width", `${this.toSvg(angleStrokeWidth)}`);
            prime.style.cursor = "pointer";
    
            this.parentView.G0.appendChild(prime);
            this.primes.push(prime);
        }

        return [num_arc, num_prime];
    }

    drawRightAngle(p: Vec2, q1: Vec2, q2: Vec2){
        const r = this.toSvg(rightAngleLength);
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

    drawAngleArc(){
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

        let [ theta1, theta2, deltaTheta, largeArcSweepFlag] = calcLargeArcSweepFlag(q1, q2);


        for(let [i, arc] of this.arcs.entries()){

            const r = this.toSvg(angleRadius) * (1 + 0.1 * i);
            const p1 = p.add(q1.mul(r));
            const p2 = p.add(q2.mul(r));

            const d = `M${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArcSweepFlag} 1 ${p2.x} ${p2.y}`;

            arc.setAttribute("d", d);
        }

        for(let [i, prime] of this.primes.entries()){
            let theta = theta1 + deltaTheta * (i + 1) / (num_prime + 1);

            const r = this.toSvg(angleRadius);

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
        this.drawAngleArc();
        this.updateNamePos();
    }

    click =(ev: MouseEvent, pt:Vec2): void => {
        const line = this.parentView.getLine(ev);
        
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

                this.drawAngleArc();
        
                for(let line2 of this.lines){

                    line2.addListener(this);
                }

                this.finishTool();
            }
        }
    }

    pointermove = (ev: PointerEvent) : void => {
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

    setEnable(enable: boolean){
        super.setEnable(enable);
        this.image.setAttribute("visibility", (enable ? "visible" : "hidden"));
    }

    summary() : string {
        return "画像";
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
        this.addHandle(this.clickHandle(ev, pt));

        this.image.setAttribute("x", "" + this.handles[0].pos.x);
        this.image.setAttribute("y", "" + this.handles[0].pos.y);
        this.finishTool();
    }
}

}
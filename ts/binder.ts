namespace bansho {

declare let mat4:any;
declare let vec4:any;

declare let Viz : any;

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
let viz : any;

let sim: Simulation;

let srcVar : Variable | null = null;

let simEditDlg            : HTMLDialogElement;
let simParamsInp          : HTMLInputElement;

let texEditDlg            : HTMLDialogElement;
let texShapeInp           : HTMLInputElement;
let texShapeValue         : HTMLElement;
let currentTex            : Variable;
let texTexelTypeSel       : HTMLSelectElement;

let pkgEditDlg            : HTMLDialogElement;
let pkgParamsInp          : HTMLInputElement;
let pkgNumInputFormulaInp : HTMLInputElement;
let pkgFragmentShaderSel  : HTMLSelectElement;
let pkgDisplaySel         : HTMLSelectElement;
let pkgSpeech             : HTMLDivElement;
export let pkgVertexShaderDiv: HTMLDivElement;

let currentPkg            : PackageInfo;

export function getSimulation(){
    return sim;
}

export function addTokenNode(div: HTMLDivElement, token: Token){
    if(token.typeTkn == TokenType.space){

        let span = document.createElement("span");
        span.innerHTML = "&nbsp;".repeat(token.text.length);
        div.appendChild(span);
    }
    else{

        let span = document.createElement("span");
        switch(token.typeTkn){
        case TokenType.reservedWord: span.style.color = "blue"; break;
        case TokenType.type        : span.style.color = "green"; break;
        case TokenType.Number      : span.style.color = "red"; break;
        case TokenType.lineComment : span.style.color = "teal"; break;
        }
        span.textContent = token.text;
        div.appendChild(span);
    }
}

function setCode(text: string){
    pkgVertexShaderDiv.innerHTML= "";

    for(let line of text.split('\n')){
        let div = document.createElement("div");
        pkgVertexShaderDiv.appendChild(div);

        let tokens = Lex(line);
        if(tokens.length == 0){
            // div.appendChild(document.createElement("br"));
            div.innerHTML = "<span><br></span>";
            continue;
        }

        for(let token of tokens){
            if(token.typeTkn == TokenType.newLine){
            
                throw new Error();
            }
            else{

                addTokenNode(div, token);
            }
        }
    }
}

export class Variable {
    package!         : PackageInfo;
    modifier!        : string;
    type!            : string;
    texelType       : string | null = null;
    name!            : string;
    dstVars         : Variable[] = [];
    shapeFormula    : string = "";

    constructor(obj: any){
        Object.assign(this, obj);
    }

    idVar(){
        return `${this.package.id}_${this.name}`;
    }

    makeObj() : any {
        let obj = Object.assign({}, this) as any;
        obj.typeName = Variable.name;
        obj.dstVars = this.dstVars.map(x => x.idVar());
        delete obj.package;

        return obj;
    }

    /*
        コピー先がテクスチャの場合に、コピー元からテクセル型とshapeをコピーする。
    */
    copyTypeShape(srcVar: Variable){
        if((this.type == "sampler2D" || this.type == "sampler3D") && this.texelType == null){
            this.texelType = srcVar.type;
            if(this.shapeFormula == ""){

                this.shapeFormula = srcVar.package.numInputFormula;
            }
        }
    }

    click(ev: MouseEvent){
        if(ev.ctrlKey){
            if(srcVar == null){
                srcVar = this;
            }
            else{
                srcVar.dstVars.push(this);

                // コピー先がテクスチャの場合に、コピー元からテクセル型とshapeをコピーする。
                this.copyTypeShape(srcVar);

                srcVar = null;
                makeGraph();
            }
        }
        else{
            if(this.type == "sampler2D" || this.type == "sampler3D"){
                showTextureEditDlg(this);
            }
        }
    }
}

export class PackageInfo {
    id!              : string;
    params           : string = "";
    numInputFormula  : string = "";
    numGroup         : string | undefined = undefined;
    mode             : string = "";
    vertexShader!    : string;
    fragmentShader   : string = gpgputs.GPGPU.minFragmentShader;
    display          : string = "";
    vars             : Variable[] = [];

    static newObj() : PackageInfo {
        // 空き番を探す。
        let id_num = 0;
        while(sim.packageInfos.some(x => x.id ==  alphabet[id_num])){
            id_num++;
        }

        return {
            typeName        : PackageInfo.name,
            id              : alphabet[id_num],
            params          : "",
            numInputFormula : "",
            numGroup        : undefined,
            mode            : "",
            vertexShader    : "",
            fragmentShader  : "",
            display         : "",
            vars            : []
        } as unknown as PackageInfo;
    }
}

export class Simulation extends Widget implements gpgputs.DrawScenelistener {
    view!        : View;
    params       : string = "";
    packageInfos : PackageInfo[] = [];
    startTime    : number = 0;
    prevTime     : number = 0;
    points       : Point[] = [];

    constructor(){
        super();
    }

    varsAll(){
        let v: Variable[] = [];
        for(let info of this.packageInfos){
            v.push(... info.vars);
        }
        return v;
    }

    make(obj: any) : Widget {
        super.make(obj);

        this.view = getPrevView();
        if(this.view.gpgpu == null){
            this.view.gpgpu = make3D(this.view.canvas);
        }
        gl = gpgputs.gl;

        let va_map : { [id:string] : Variable} = {};
        for(let info of this.packageInfos){

            info.vars = info.vars.map(x => new Variable(x));

            for(let va of info.vars){
                va.package = info;
                va_map[va.idVar()] = va;
            }
        }

        for(let info of this.packageInfos){
            for(let va of info.vars){
                va.package = info;

                va.dstVars = (va.dstVars as unknown as string[]).map(id => va_map[id]);
            }
        }

        return this;
    }

    makeObj() : any {        
        for(let [i, info] of this.packageInfos.entries()){
            info.id = alphabet[i];
        }

        let infos = [];
        for(let info of this.packageInfos){
            let obj = Object.assign({}, info);
            obj.vars = info.vars.map(va => va.makeObj());

            infos.push(obj);
        }

        return Object.assign(super.makeObj(), {
            params       : this.params,
            packageInfos : infos
        });
    }

    summary() : string {
        return "シミュレーション";
    }
    
    enable(){
        sim = this;
        this.applyGraph();

        this.view.gpgpu!.drawParam = new gpgputs.DrawParam(0, 0, 0, 0, 0, -5.0);
    }

    disable(){
        this.view.gpgpu!.clearAll();
    }

    delete(){
        this.view.gpgpu!.clearAll();
    }

    applyGraph(){
        this.view.gpgpu!.clearAll();
        // this.view.gpgpu = make3D(this.view.canvas);

        let packages: gpgputs.Package[] = [];

        let info2pkg = new Map<PackageInfo, gpgputs.Package>();

        for(let pkgInfo of this.packageInfos){
            let pkg = makePkgFromInfo(pkgInfo);
            info2pkg.set(pkgInfo, pkg);

            packages.push(pkg);

            // ソースの文字列内の変数の値を代入。
            if(pkgInfo.vertexShader.includes("@{")){
                let map = getParamsMap([ sim.params, pkgInfo.params ]);
                if(map == null){
                    throw new Error();
                }

                let shader = pkgInfo.vertexShader;
                for(let [name, val] of Object.entries(map)){
                    let key = `@{${name}}`;
                    while(shader.includes(key)){
                        shader = shader.replace(key, `${val}`);
                    }
                }

                pkg.vertexShader = shader;
            }

            setIOVarsValue(pkgInfo, pkg);

            // 頂点シェーダの字句解析をする。
            let tokens = Lex(pkg.vertexShader, true);
            if(tokens.some(x => x.text == "time")){
                pkg.args["time"] = 0;
            }
            if(tokens.some(x => x.text == "timeDiff")){
                pkg.args["timeDiff"] = 0;
            }
            if(tokens.some(x => x.text == "speech")){
                pkg.args["speech"] = 0;
            }
            if(tokens.some(x => x.text == "attention")){
                pkg.args["attention"] = -1;
            }
            if(tokens.some(x => x.text == "progress")){
                pkg.args["progress"] = 0;
            }

            pkg.args["tick"] = undefined;

            this.view.gpgpu!.makePackage(pkg);
        }

        for(let info of this.packageInfos){
            let pkg = info2pkg.get(info)!;

            for(let src of info.vars){

                // すべてのコピー先の変数に対し
                for(let dst of src.dstVars){
                    // コピー先の変数のパッケージ
                    let dstPkg = packages.find(x => x.id == dst.package.id);
                    if(dstPkg == undefined){
                        throw new Error();
                    }

                    // コピー元の変数からコピー先の変数へバインドする。
                    pkg.bind(src.name, dst.name, dstPkg);
                }
            }
        }

        this.makeDisplayPkgs(packages);

        this.view.gpgpu!.drawables.push(... packages);

        this.view.gpgpu!.drawScenelistener = this;

        this.startTime = NaN;
        Speech.speechIdx = -1;

        // 3D位置指定をしたPointのリスト
        this.points = getAll().filter(x => x instanceof Point && x.pos3D != undefined) as Point[];
    }

    beforeDraw() : void {
        let currentTime = (new Date()).getTime();
        
        if( isNaN(this.startTime) ){
            
            this.startTime = currentTime;
            this.prevTime  = currentTime;
        }

        for(let pkg of this.view.gpgpu!.drawables as gpgputs.Package[]){
            if(pkg.args["time"] != undefined){
                pkg.args["time"] = currentTime - this.startTime;
            }

            if(pkg.args["timeDiff"] != undefined){
                pkg.args["timeDiff"] = currentTime - this.prevTime;
            }

            if(pkg.args["speech"] != undefined){
                pkg.args["speech"] = Speech.speechIdx;
            }

            if(pkg.args["attention"] != undefined){
                if(pkg.id == Speech.attentionId){

                    pkg.args["attention"] = Speech.attentionIdx;
                }
                else{

                    pkg.args["attention"] = -1;
                }
            }

            if(pkg.args["progress"] != undefined){
                if(Speech.duration != 0){

                    pkg.args["progress"] = Math.min(1.0,  ((new Date()).getTime() - Speech.startTime) / (1000 * Speech.duration));
                }
                else{

                    pkg.args["progress"] = 0;
                }
            }           
        }

        this.prevTime = currentTime;
    }

    afterDraw(projViewMat: Float32Array)  : void {
        if(getTimelinePos() != -1){
            let widgets = glb.widgets.slice(0, getTimelinePos() + 1).reverse();

            let vp = widgets.find(x => x instanceof ViewPoint) as ViewPoint;
            if(vp != undefined){
                vp.setDrawParam();
            }
        }

        for(let pt of this.points){

            let nums = parseCalcMath({}, pt.pos3D!) as number[];
            if( ! Array.isArray(nums) || nums.length != 3 ){
                throw new Error();
            }
            nums.push(1.0);

            let v1 = new Float32Array(nums);

            let v2 = vec4.create();

            vec4.transformMat4(v2, v1, projViewMat);
            v2[0] /= v2[3];
            v2[1] /= v2[3];

            let [x1, y1, w, h] = this.view.parseViewBox();

            pt.pos.x = (x1 + 0.5 * w) + 0.5 * w * v2[0] ;
            pt.pos.y = (y1 + 0.5 * h) + 0.5 * h * v2[1] ;
            if(isNaN(pt.pos.x) || isNaN(pt.pos.y)){
                throw new Error();
            }

            pt.setPos();
        }
    }

    makeBindVars(packages: gpgputs.Package[], info1: PackageInfo, pkg1: gpgputs.Package, info2: PackageInfo, varNames: string[]){
        getIOVariables(info2);

        let pkg2 = makePkgFromInfo(info2);

        for(let name of varNames){
            let srcVar = info1.vars.find(x => x.name == `out${name}`);
            let dstVar = info2.vars.find(x => x.name == `in${name}`);
            
            if(srcVar == undefined || dstVar == undefined){
                throw new Error();
            }

            // コピー先がテクスチャの場合に、コピー元からテクセル型とshapeをコピーする。
            dstVar.copyTypeShape(srcVar);
        }

        info2.params = info1.params;
        setIOVarsValue(info2, pkg2);

        for(let name of varNames){
            // コピー元の変数からコピー先の変数へバインドする。
            pkg1.bind(`out${name}`, `in${name}`, pkg2);
        }

        this.view.gpgpu!.makePackage(pkg2);
        packages.push(pkg2);

        return pkg2;
    }


    makeDisplayPkgs(packages: gpgputs.Package[]){
        for(let info1 of this.packageInfos){
            let pkg1 = packages.find(x => x.id == info1.id)!;
            console.assert(pkg1 != undefined);
            
            switch(info1.display){
            case "Circle":{                
                let info2 = Object.assign(PackageInfo.newObj(), CirclePkg(sim, info1, pkg1.numInput!));

                this.makeBindVars(packages, info1, pkg1, info2, [ "Pos", "R", "Nrm", "Color" ]);
                break;
            }

            case "Sphere":{                
                let info2 = Object.assign(PackageInfo.newObj(), SpherePkg(sim, info1, pkg1.numInput!));

                this.makeBindVars(packages, info1, pkg1, info2, [ "Pos", "R", "Color" ]);
                break;
            }

            case "Tube":{                
                let info3 = Object.assign(PackageInfo.newObj(), TubePkg(pkg1.numInput!));

                this.makeBindVars(packages, info1, pkg1, info3, [ "Pos", "Vec", "Color" ]);
                break;
            }
    
            case "Arrow3D":{
                let info2 = Object.assign(PackageInfo.newObj(), ArrowFanPkg(pkg1.numInput!));

                this.makeBindVars(packages, info1, pkg1, info2, [ "Pos", "Vec", "Color" ]);
                
                let info3 = Object.assign(PackageInfo.newObj(), TubePkg(pkg1.numInput!, 0.8));

                this.makeBindVars(packages, info1, pkg1, info3, [ "Pos", "Vec", "Color" ]);
                break;
            }

            case "Triangle":
                let info2 = Object.assign(PackageInfo.newObj(), TrianglePkg(pkg1.numInput!));
                this.makeBindVars(packages, info1, pkg1, info2, [ "Pos1", "Pos2", "Pos3", "Color" ]);
                break;

            case "Parallelogram":{
                let info2 = Object.assign(PackageInfo.newObj(), ParallelogramPkg(pkg1.numInput!));
                this.makeBindVars(packages, info1, pkg1, info2, [ "Pos", "Vec1", "Vec2", "Color" ]);
                break;
            }

            case "Cuboid":{
                let info2 = Object.assign(PackageInfo.newObj(), CuboidPkg(pkg1.numInput!));
                this.makeBindVars(packages, info1, pkg1, info2, [ "Pos", "Size", "Color" ]);
                break;
            }

            }        
        }
    }
}

export class ViewPoint extends Widget {
    static lastViewPoint : ViewPoint | null = null;
    static lastProgress  : number = 0;

    Rotaion     : string = "0, 0, 0";
    Translation : string = "0, 0, -5";
    Duration    : number = 3;

    view!       : View;
    startTime   : number = 0;
    
    constructor(){
        super();
    }

    make(obj: any) : Widget {
        super.make(obj);

        return this;
    }

    makeObj() : any {        
        return Object.assign(super.makeObj(), {
            Rotaion     : this.Rotaion,
            Translation : this.Translation,
            Duration    : this.Duration
        });
    }

    summary() : string {
        return "視点";
    }
    
    enable(){
        ViewPoint.lastViewPoint = null;
        ViewPoint.lastProgress  = 0;

        this.startTime = (new Date()).getTime();
        console.log(`視点 有効 (${this.Rotaion}) (${this.Translation})`);
    }

    disable(){
        this.startTime = 0;
    }

    progress(){
        let t = ((new Date()).getTime() - this.startTime) /  (1000 * this.Duration);
        return Math.min(1.0, t);
    }

    setDrawParam(){
        if(ViewPoint.lastViewPoint == this && ViewPoint.lastProgress == this.progress()){
            // 前回と同じ場合

            return;
        }
        ViewPoint.lastViewPoint = this;
        ViewPoint.lastProgress  = this.progress();

        this.view = getPrevView();

        if(this.view.gpgpu!.drawables.length == 0){
            return;
        }

        let map = { pi: Math.PI, t:this.progress() };

        let rot = parseMath(this.Rotaion).calc(map) as number[];
        let trn = parseMath(this.Translation).calc(map) as number[];
        for(let nums of [rot, trn]){
            if(! Array.isArray(nums) || nums.length != 3 || nums.some(x => typeof x != "number")){
                throw new Error();
            }
        }

        this.view.gpgpu!.drawParam = new gpgputs.DrawParam(rot[0], rot[1], rot[2], trn[0], trn[1], trn[2]);
    }

    propertyNames() : string[] {
        return [ "Rotaion", "Translation", "Duration" ];
    }

    setRotaion(value:any){
        let trm = parseMath(value);
        this.Rotaion = value;
    }

    setTranslation(value:any){
        let trm = parseMath(value);
        this.Translation = value;
    }

    setDuration(value:any){
        this.Duration = value;
    }

}

export function getPrevView(){
    let prevView = glb.widgets.slice().reverse().find(x => x instanceof View) as View;
    if(prevView == undefined){
        throw new Error();
    }

    return prevView;
}

export function make3D(canvas: HTMLCanvasElement){
    let gpgpu = gpgputs.CreateGPGPU(canvas);
    gl = gpgputs.gl;

    gpgpu.startDraw3D([]);

    return gpgpu;
}

function setIOVarsValue(pkgInfo: PackageInfo, pkg: gpgputs.Package){
    for(let va1 of pkgInfo.vars){
        if(pkg.args[va1.name] == undefined){
            // 値が未定義の場合

            if(va1.type == "sampler2D" || va1.type == "sampler3D"){
                // テクスチャの場合

                let shape = calcTexShape(pkgInfo, va1.shapeFormula);
                if(va1.texelType == null || shape == null){
                    throw new Error();
                }
                if(pkg.vertexShader.includes("@factorize@")){
                    // 頂点数を因数分解する場合

                    console.assert(shape.length == 2 && shape[0] == 1);
                    shape = Factorize(shape[1]);
                }

                pkg.args[va1.name] = new gpgputs.TextureInfo(va1.texelType, shape);
            }
            else{
                // 配列の場合

                pkg.args[va1.name] = new Float32Array( pkg.numInput! * gpgputs.vecDim(va1.type) );
            }
        }
    }
}

function makePkgFromInfo(pkgInfo: PackageInfo){
    let pkg = new gpgputs.Package(pkgInfo);
    pkg.mode = gpgputs.getDrawMode(pkgInfo.mode);
    pkg.args = {};
    pkg.numInput = calcPkgNumInput(pkgInfo.params, pkgInfo.numInputFormula);
    if(isNaN(pkg.numInput)){
        throw new Error();
    }
    if(pkgInfo.numGroup != undefined){
        pkg.numGroup = calcPkgNumInput(pkgInfo.params, pkgInfo.numGroup);
        if(isNaN(pkg.numGroup)){
            throw new Error();
        }
    }

    return pkg;
}

function getIOVariables(pkg: PackageInfo){
    pkg.vars = [];

    let tokens = Lex(pkg.vertexShader, true);
    tokens = tokens.filter(x => x.typeTkn != TokenType.space);

    for(let [i, token] of tokens.entries()){
        if(["uniform", "in", "out"].includes(token.text)){
            if(["uPMVMatrix", "uNMatrix", "tick", "time", "timeDiff", "speech", "attention", "progress", "fragmentColor", "gl_Position", "vLightWeighting"].includes(tokens[i + 2].text)){
                continue;
            }

            let name = tokens[i + 2].text;
            let iovar = new Variable({
                id       : `${pkg.id}_${name}`,
                package  : pkg,
                modifier : token.text,
                type     : tokens[i + 1].text,
                name     : name
            });
            pkg.vars.push(iovar);
        }
    }
}

export function getParamsMap(formulas: string[]){
    let map: { [name: string]: number } = {};

    for(let formula of formulas){
        if(formula.trim() == ""){
            continue;
        }
        let items = formula.split(',');
        for(let item of items){
            let v = item.split('=');
            if(v.length != 2){
                return null;
            }

            let [name, value] = v;
            let n = parseCalcMath(map, value) as number;
            if(isNaN(n)){
                
                return null;
            }
    
            map[name.trim()] = n;
        }    
    }

    return map;
}

function calcTexShape(pkg: PackageInfo, shapeFormula: string){
    let map = getParamsMap([ sim.params, pkg.params ]);
    if(map == null){
        return null;
    }

    let shape  = shapeFormula.split(',').map(x => parseCalcMath(map!, x.trim())) as number[];
    if(shape.length < 1 || 3 < shape.length || shape.some(x => isNaN(x))){
        return null;
    }

    if(shape.length == 1){
        shape = [1, shape[0]];
    }

    return shape
}

function calcPkgNumInput(pkgParams: string, numInputFormula: string){
    let map = getParamsMap([ sim.params, pkgParams ]);
    if(map == null){
        return NaN;
    }

    return parseCalcMath(map, numInputFormula) as number;
}

function showTextureEditDlg(tex: Variable){
    currentTex = tex;

    getElement("tex-name").innerText = tex.name;
    if(tex.texelType == null){
        texTexelTypeSel.selectedIndex = -1;
    }
    else{
        texTexelTypeSel.value = tex.texelType;
    }

    texShapeInp.value = tex.shapeFormula;
    texShapeValue.innerText = "";

    texEditDlg.showModal();
}

//-------------------------------------------------- パッケージ編集画面

function showPackageEditDlg(pkg: PackageInfo){
    currentPkg = pkg;

    pkgParamsInp.value   = pkg.params;

    pkgNumInputFormulaInp.value = pkg.numInputFormula;

    if(pkg.fragmentShader == gpgputs.GPGPU.minFragmentShader){
        pkgFragmentShaderSel.value = "none";
    }
    else if(pkg.fragmentShader == gpgputs.GPGPU.pointFragmentShader){
        pkgFragmentShaderSel.value = "point";
    }
    else if(pkg.fragmentShader == gpgputs.GPGPU.planeFragmentShader){
        pkgFragmentShaderSel.value = "plane";
    }

    pkgDisplaySel.value = currentPkg.display;

    setCode(pkg.vertexShader);

    let v = Array.from(glb.widgets.filter(x => x instanceof Speech).entries()).map(i => `${i[0]} ${(i[1] as Speech).Text}`);
    v = v.map(x => x.replace(/ @/g, '&nbsp;<span style="color:red">@</span>'));
    pkgSpeech.innerHTML = v.join("<br/>");

    pkgEditDlg.showModal();
    console.log(`pkg.id click`);    
}

function displayTitle(display: string){
    switch(display){
    case ""             : return "なし";
    case "Circle"       : return "円";
    case "Sphere"       : return "球";
    case "Tube"         : return "管";
    case "Arrow3D"      : return "矢印3D";
    case "Triangle"     : return "三角形";
    case "Parallelogram": return "平行四辺形";
    case "Cuboid"       : return "直方体";
    default             : throw new Error();
    }
}

function makeGraph(){
    let texts : string[] = [];

    let varsAll_old = sim.varsAll();

    for(let pkg of sim.packageInfos){
        getIOVariables(pkg);

        let lines : string[] = [];
        let invars = pkg.vars.filter(v=> v.modifier == "uniform" || v.modifier == "in");
        for(let va of invars){
            let old_va = varsAll_old.find(x => x.idVar() == va.idVar());
            let shape = old_va != undefined ? old_va.shapeFormula : "";

            lines.push(`${va.idVar()} [ id="${va.idVar()}", label = "${va.name} : ${shape}", shape = box];`);
            lines.push(`${va.idVar()} -> ${pkg.id}_vertex`);
        }

        let outvars = pkg.vars.filter(v=> v.modifier == "out");
        for(let x of outvars){
            lines.push(`${x.idVar()} [ id="${x.idVar()}", label = "${x.name}", shape = box];`);
            lines.push(`${pkg.id}_vertex -> ${x.idVar()}`);
        }
        
        texts.push(... `subgraph cluster_${pkg.id} {
            label = "${pkg.id} ${displayTitle(pkg.display)}";
        
            ${pkg.id}_vertex [ id="${pkg.id}_vertex", label = "シェーダー", shape = box];

            ${lines.join('\n')}
        };
        `.split('\n'))
    }

    let varsAll_new = sim.varsAll();
    for(let src_old of varsAll_old){
        let src_new = varsAll_new.find(x => x.idVar() == src_old.idVar());
        if(src_new != undefined){
            src_new.texelType    = src_old.texelType;
            src_new.shapeFormula = src_old.shapeFormula;

            for(let dst_old of src_old.dstVars){
                let dst_new = varsAll_new.find(x => x.idVar() == dst_old.idVar());
                if(dst_new != undefined){
                    src_new.dstVars.push(dst_new);
                    texts.push(`${src_new.idVar()} -> ${dst_new.idVar()} `);
                }
            }
        }
    }
    // let box = packages.map(x => `${x.id} [ label="パッケージ", id="${x.id}" ];`).join('\n    ');

    let dot = `
    digraph graph_name {
        graph [ charset = "UTF-8" ];
        ${texts.join("\n")}
    }
    `;
    
    // dot = 'digraph { a -> b }';
    viz.renderSVGElement(dot)
    .then(function(element: any) {
        let div = getElement("sim-edit-div");
        if(div.firstChild != null){
            div.firstChild.remove();
        }

        div.appendChild(element);

        setGraphEvent();
    })
    .catch((error: any) => {
        // Create a new Viz instance (@see Caveats page for more info)
        viz = new Viz();

        // Possibly display the error
        console.error(error);
    });
}

export function initBinder(){
    simEditDlg            = getElement("sim-edit-dlg") as HTMLDialogElement;
    simParamsInp          = getElement("sim-params") as HTMLInputElement;

    pkgEditDlg            = getElement("pkg-edit-dlg") as HTMLDialogElement;
    pkgParamsInp          = getElement("pkg-params") as HTMLInputElement;
    pkgNumInputFormulaInp = getElement("pkg-numInput") as HTMLInputElement;
    pkgFragmentShaderSel  = getElement("pkg-fragment-shader") as HTMLSelectElement;
    pkgDisplaySel         = getElement("pkg-display") as HTMLSelectElement;
    pkgVertexShaderDiv    = getElement("pkg-vertex-shader") as HTMLDivElement;
    pkgSpeech             = getElement("pkg-speech") as HTMLDivElement;
    
    //-------------------------------------------------- テクスチャ編集画面
    texEditDlg      = getElement("tex-edit-dlg") as HTMLDialogElement;
    texShapeInp     = getElement("tex-shape") as HTMLInputElement;
    texShapeValue   = getElement("tex-shape-value");
    texTexelTypeSel = getElement("tex-texel-type") as HTMLSelectElement;

    viz = new Viz();

    //-------------------------------------------------- 3D編集画面

    setBinderEvent();
    initCodeEditor();
}

function setBinderEvent(){
    // パッケージ追加
    getElement("add-simulation").addEventListener("click", (ev: MouseEvent)=>{
        sim = new Simulation();
        sim.make({});
        glb.addWidget(sim);
        simEditDlg.showModal();
    });

    // 視点追加
    getElement("add-viewpoint").addEventListener("click", (ev: MouseEvent)=>{
        let vp = new ViewPoint();
        vp.make({});
        glb.addWidget(vp);
    });
    
    //-------------------------------------------------- シミュレーション編集画面

    simParamsInp.addEventListener("blur", function(ev: FocusEvent){
        let map = getParamsMap([ simParamsInp.value ]);
        simParamsInp.style.color = map == null ? "red" : "black";
        if(map != null){
            sim.params = simParamsInp.value.trim();
        }
    });

    getElement("add-shape-pkg").addEventListener("click", (ev: MouseEvent)=>{
        let sel = getElement("sel-shape-pkg") as HTMLSelectElement;

        if(sel.value == "cube"){
            sim.packageInfos.push( Object.assign(PackageInfo.newObj(), CubePkg()) );
        }
        else if(sel.value == "Arrow1D"){
            sim.packageInfos.push( Object.assign(PackageInfo.newObj(), Arrow1DPkg) );
        }
        else if(sel.value == "surface"){
            sim.packageInfos.push( Object.assign(PackageInfo.newObj(), SurfacePkg()) );
        }
        else{
            return;
        }

        makeGraph();
    });

    getElement("add-package").addEventListener("click", (ev: MouseEvent)=>{
        let pkg = Object.assign(
            PackageInfo.newObj(),
            {
                mode            : gpgputs.getDrawModeText(gl.POINTS),
                vertexShader    : userShader,
                fragmentShader  : gpgputs.GPGPU.minFragmentShader,
            }
        );
        
        sim.packageInfos.push(pkg);

        makeGraph();
    });
    
    getElement("sim-edit-ok").addEventListener("click", (ev: MouseEvent)=>{
        simEditDlg.close();
        let obj = sim.makeObj();
        console.log(`${JSON.stringify(obj, null, 4)}`);
        sim.enable();
    })

    getElement("sim-edit-cancel").addEventListener("click", (ev: MouseEvent)=>{
        sim.view.gpgpu!.clearAll();
        simEditDlg.close();
    })

    //-------------------------------------------------- パッケージ編集画面

    pkgParamsInp.addEventListener("blur", function(ev: FocusEvent){
        let map = getParamsMap([ simParamsInp.value, pkgParamsInp.value]);
        pkgParamsInp.style.color = map == null ? "red" : "black";
    });

    pkgNumInputFormulaInp.addEventListener("blur", function(ev: FocusEvent){
        let val = NaN;

        let map = getParamsMap([ simParamsInp.value, pkgParamsInp.value ]);
        if(map != null){

            val  = parseCalcMath(map, this.value.trim()) as number;
        }

        pkgNumInputFormulaInp.style.color = isNaN(val) ? "red" : "black";

        getElement("pkg-numInput-value").innerText = `${val}`;
    });

    getElement("pkg-edit-cancel").addEventListener("click", (ev: MouseEvent)=>{
        pkgEditDlg.close();
    });

    getElement("pkg-edit-ok").addEventListener("click", (ev: MouseEvent)=>{
        let numInputFormula = pkgNumInputFormulaInp.value.trim();


        let val  = calcPkgNumInput(pkgParamsInp.value, numInputFormula);
        if(! isNaN(val)){

            currentPkg.params          = pkgParamsInp.value;
            currentPkg.numInputFormula = numInputFormula;

            let text = pkgVertexShaderDiv.innerText;
            text = text.replace(/\n\n/g, '\n');
            while(text.includes('\xA0')){
                text = text.replace('\xA0', ' ');
            }

            currentPkg.vertexShader    = text;

            if(pkgFragmentShaderSel.value == "none"){
                currentPkg.fragmentShader = gpgputs.GPGPU.minFragmentShader;
            }
            else if(pkgFragmentShaderSel.value == "point"){
                currentPkg.fragmentShader = gpgputs.GPGPU.pointFragmentShader
            }
            else if(pkgFragmentShaderSel.value == "plane"){
                currentPkg.fragmentShader = gpgputs.GPGPU.planeFragmentShader
            }
            else{
                throw new Error();
            }

            currentPkg.display = pkgDisplaySel.value;

            let lines = pkgSpeech.innerText.replace(/\n\n/g, '\n').replace(/\xA0/g, ' ').split('\n');
            let acts  = glb.widgets.filter(x => x instanceof Speech) as Speech[];
            if(lines.length == acts.length){
                for(let [i, act] of acts.entries()){
                    let s = lines[i].replace(/^\d+\s/, "");
                    if(s != act.Text){
                        console.log(`前:[${act.Text}]`);
                        console.log(`後:[${s}]`);
                        act.Text = s;
                        updateSummary(act);
                    }
                }
            }

            pkgEditDlg.close();

            makeGraph();
        }
    });

    getElement("pkg-edit-del").addEventListener("click", (ev: MouseEvent)=>{
        pkgEditDlg.close();

        // パッケージを削除する。
        removeArrayElement(sim.packageInfos, currentPkg);

        // パッケージ内の変数へのバインドを削除する。
        sim.varsAll().forEach(x => {
            x.dstVars = x.dstVars.filter(y => y.package != currentPkg);
        });

        makeGraph();
    });

    //-------------------------------------------------- テクスチャ編集画面

    texShapeInp.addEventListener("blur", function(ev: FocusEvent){
        let items = this.value.split(',');

        let map = getParamsMap([ simParamsInp.value, currentTex.package.params ]);
        if(map != null){

            let vals  = items.map(x => parseCalcMath(map!, x.trim()));
            let text  = vals.map(x => `${x}`).join(", ");
    
            texShapeValue.innerText = text;
        }
        else{
            texShapeValue.innerText = "";
        }
    });

    getElement("tex-edit-cancel").addEventListener("click", (ev: MouseEvent)=>{
        texEditDlg.close();
    })

    getElement("tex-edit-ok").addEventListener("click", (ev: MouseEvent)=>{
        let shape = calcTexShape(currentTex.package, texShapeInp.value);
        if(shape == null){
            return;
        }

        currentTex.shapeFormula = texShapeInp.value.trim();
        currentTex.texelType = texTexelTypeSel.value;

        texEditDlg.close();
        makeGraph();
    })
}

function setGraphEvent(){
    for(let pkg of sim.packageInfos){

        let dom = getElement(`${pkg.id}_vertex`);
        dom.addEventListener("click", function(ev: MouseEvent){

            let pkg1 = sim.packageInfos.find(x => this.id == `${x.id}_vertex`);
            if(pkg1 == undefined) throw new Error();

            showPackageEditDlg(pkg1);
        });
    }

    for(let va of sim.varsAll()){
        let dom = getElement(`${va.package.id}_${va.name}`);
        dom.addEventListener("click", function(ev: MouseEvent){

            let va1 = sim.varsAll().find(x => this.id == x.idVar());
            if(va1 == undefined) throw new Error();
            va1.click(ev);
        });
    }
}

export function openSimulationDlg(act: Simulation){
    sim = act;
    sim.points = [];
    simParamsInp.value = sim.params;
    sim.disable();
    simEditDlg.showModal();
    makeGraph();
}

export function Factorize(cnt: number){
    let i1 = 1, i2 = cnt;

    for(let d of [ 5, 3, 2 ]){
        while(i2 % d == 0){
            i2 /= d;
            i1 *= d;

            if(Math.sqrt(cnt) <= i1){
                return [ i1, i2 ];
            }
        }
    }
    return [ i1, i2 ];
}

}
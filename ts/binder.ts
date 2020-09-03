namespace bansho {

declare let InverseSquareShader: string;
declare let Viz : any;

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
export let pkgVertexShaderDiv: HTMLDivElement;

let currentPkg            : PackageInfo;

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
            div.appendChild(document.createElement("br"));
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
    id!              : string;
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

    makeObj() : any {
        let obj = Object.assign({}, this) as any;
        obj.typeName = Variable.name;
        obj.dstVars = this.dstVars.map(x => `${x.id}`);
        delete obj.package;

        return obj;
    }

    click(ev: MouseEvent){
        if(ev.ctrlKey){
            if(srcVar == null){
                srcVar = this;
            }
            else{
                srcVar.dstVars.push(this);
                if((this.type == "sampler2D" || this.type == "sampler3D") && this.texelType == null){
                    this.texelType = srcVar.type;
                    if(this.shapeFormula == ""){

                        this.shapeFormula = srcVar.package.numInputFormula;
                    }
                }

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
    mode             : string = "";
    vertexShader!    : string;
    fragmentShader   : string = gpgputs.GPGPU.minFragmentShader;

    static cnt = 0;
    static newObj() : PackageInfo {
        return {
            typeName        : PackageInfo.name,
            id              : `pkg_${PackageInfo.cnt++}`,
            params          : "",
            numInputFormula : "",
            numInput        : undefined,
            mode            : "",
            vertexShader    : "",
            fragmentShader  : "",
        } as unknown as PackageInfo;
    }
}

export class Simulation extends Widget {
    view!        : View;
    params       : string = "";
    packageInfos : PackageInfo[] = [];
    varsAll      : Variable[] = [];

    constructor(){
        super();
    }

    make(obj: any) : Widget {
        super.make(obj);

        let prevView = glb.widgets.slice().reverse().find(x => x instanceof View) as View;
        if(prevView == undefined){
            throw new Error();
        }

        this.view = prevView;
        if(this.view.gpgpu == null){
            this.view.gpgpu = make3D(this.view.canvas);
        }
        gl = gpgputs.gl;

        let va_map : { [id:string] : Variable} = {};

        this.varsAll.forEach(x => va_map[x.id] = x);

        for(let va of this.varsAll){
            let pkg = this.packageInfos.find(x => va.id.startsWith(x.id + "_"));
            if(pkg == undefined){
                throw new Error();
            }
            va.package = pkg;

            va.dstVars = (va.dstVars as unknown as string[]).map(id => va_map[id]);
        }

        return this;
    }

    makeObj() : any {        
        return Object.assign(super.makeObj(), {
            params       : this.params,
            packageInfos : this.packageInfos,
            varsAll      : this.varsAll.map(x => x.makeObj())
        });
    }

    summary() : string {
        return "シミュレーション";
    }
    
    enable(){
        sim = this;
        this.applyGraph();
    }

    disable(){
        this.view.gpgpu!.clearAll();
    }

    applyGraph(){
        this.view.gpgpu!.clearAll();
        // this.view.gpgpu = make3D(this.view.canvas);

        let packages: gpgputs.Package[] = [];

        for(let pkgInfo of this.packageInfos){
            let pkg = new gpgputs.Package(pkgInfo);
            pkg.mode = gpgputs.getDrawMode(pkgInfo.mode);
            pkg.args = {};
            pkg.numInput = calcPkgNumInput(pkgInfo.params, pkgInfo.numInputFormula);
            if(isNaN(pkg.numInput)){
                throw new Error();
            }

            packages.push(pkg);


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

            let vars = this.varsAll.filter(x => x.id.startsWith(`${pkg.id}_`));
            for(let va1 of vars){
                if(pkg.args[va1.name] == undefined){
                    if(va1.type == "sampler2D" || va1.type == "sampler3D"){

                        let shape = calcTexShape(pkgInfo, va1.shapeFormula);
                        if(va1.texelType == null || shape == null){
                            throw new Error();
                        }

                        pkg.args[va1.name] = new gpgputs.TextureInfo(va1.texelType, shape);
                    }
                    else{
                        pkg.args[va1.name] = new Float32Array( pkg.numInput * gpgputs.vecDim(va1.type) );
                    }
                }
            }

            this.view.gpgpu!.makePackage(pkg);
        }

        for(let pkg of packages){
            let vars = this.varsAll.filter(x => x.id.startsWith(`${pkg.id}_`));
            for(let src of vars){

                for(let dst of src.dstVars){
                    let dstPkg = packages.find(x => x.id == dst.package.id);
                    if(dstPkg == undefined){
                        throw new Error();
                    }
                    pkg.bind(src.name, dst.name, dstPkg);
                }
            }

            pkg.args["tick"] = undefined;
        }

        this.view.gpgpu!.drawables.push(... packages);
    }
}


function getIOVariables(pkg: PackageInfo){
    let vars: Variable[] = [];

    let tokens = Lex(pkg.vertexShader);
    tokens = tokens.filter(x => x.typeTkn != TokenType.space);

    for(let [i, token] of tokens.entries()){
        if(["uniform", "in", "out"].includes(token.text)){
            if(["uPMVMatrix", "uNMatrix", "tick", "fragmentColor", "gl_Position", "vLightWeighting"].includes(tokens[i + 2].text)){
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
            vars.push(iovar);
        }
    }

    return vars;
}

function getParamsMap(formulas: string[]){
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
            let n = parseMath(map, value);
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

    let shape  = shapeFormula.split(',').map(x => parseMath(map!, x.trim()));
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

    return parseMath(map, numInputFormula);
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

    setCode(pkg.vertexShader);
    pkgEditDlg.showModal();
    console.log(`pkg.id click`);    
}

function makeGraph(){
    let texts : string[] = [];

    let varsAll_old = sim.varsAll;
    sim.varsAll = [];    
    for(let pkg of sim.packageInfos){
        let vars = getIOVariables(pkg);
        sim.varsAll.push(...vars);

        let lines : string[] = [];
        let invars = vars.filter(v=> v.modifier == "uniform" || v.modifier == "in");
        for(let x of invars){
            lines.push(`${x.id} [ id="${x.id}", label = "${x.name}", shape = box];`);
            lines.push(`${x.id} -> ${pkg.id}_vertex`);
        }

        let outvars = vars.filter(v=> v.modifier == "out");
        for(let x of outvars){
            lines.push(`${x.id} [ id="${x.id}", label = "${x.name}", shape = box];`);
            lines.push(`${pkg.id}_vertex -> ${x.id}`);
        }
        
        texts.push(... `subgraph cluster_${pkg.id} {
            label = "${pkg.id}";
        
            ${pkg.id}_vertex [ id="${pkg.id}_vertex", label = "シェーダー", shape = box];

            ${lines.join('\n')}
        };
        `.split('\n'))
    }

    for(let src_old of varsAll_old){
        let src_new = sim.varsAll.find(x => x.id == src_old.id);
        if(src_new != undefined){
            src_new.texelType    = src_old.texelType;
            src_new.shapeFormula = src_old.shapeFormula;

            for(let dst_old of src_old.dstVars){
                let dst_new = sim.varsAll.find(x => x.id == dst_old.id);
                if(dst_new != undefined){
                    src_new.dstVars.push(dst_new);
                    texts.push(`${src_new.id} -> ${dst_new.id} `);
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
    pkgVertexShaderDiv    = getElement("pkg-vertex-shader") as HTMLDivElement;
    
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
    getElement("open-package").addEventListener("click", (ev: MouseEvent)=>{

        sim = new Simulation();
        sim.make({});
        glb.addWidget(sim);
        simEditDlg.showModal();
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
        let pkg: PackageInfo;

        if(sel.value == "sphere"){
            pkg = Object.assign(PackageInfo.newObj(), SpherePkg);
        }
        else if(sel.value == "cube"){
            pkg = Object.assign(PackageInfo.newObj(), CubePkg());
        }
        else{
            return;
        }

        sim.packageInfos.push(pkg);

        makeGraph();
    });

    getElement("add-package").addEventListener("click", (ev: MouseEvent)=>{
        let pkg = Object.assign(
            PackageInfo.newObj(),
            {
                mode            : gpgputs.getDrawModeText(gl.POINTS),
                vertexShader    : InverseSquareShader,
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

            val  = parseMath(map, this.value.trim());
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

            pkgEditDlg.close();
        }
    });

    //-------------------------------------------------- テクスチャ編集画面

    texShapeInp.addEventListener("blur", function(ev: FocusEvent){
        let items = this.value.split(',');

        let map = getParamsMap([ simParamsInp.value, currentTex.package.params ]);
        if(map != null){

            let vals  = items.map(x => parseMath(map!, x.trim()));
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

    for(let va of sim.varsAll){
        let dom = getElement(`${va.package.id}_${va.name}`);
        dom.addEventListener("click", function(ev: MouseEvent){

            let va1 = sim.varsAll.find(x => this.id == `${x.package.id}_${x.name}`);
            if(va1 == undefined) throw new Error();
            va1.click(ev);
        });
    }
}

export function openSimulationDlg(act: Simulation){
    sim = act;
    simParamsInp.value = sim.params;
    sim.disable();
    simEditDlg.showModal();
}

export function Factorization(cnt: number){
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

//--------------------------------------------------
// 粒子
//--------------------------------------------------

export let SpherePkg = {
    params          : "n1 = 8, n2 = 8, radius = 0.04",
    numInputFormula : "cnt * n1 * n2 * 6",
    mode            : "TRIANGLES",
    fragmentShader  : gpgputs.GPGPU.planeFragmentShader,
    vertexShader    : `

const vec3 uAmbientColor = vec3(0.2, 0.2, 0.2);
const vec3 uLightingDirection =  normalize( vec3(0.25, 0.25, 1) );
const vec3 uDirectionalColor = vec3(0.8, 0.8, 0.8);

uniform mat4 uPMVMatrix;
uniform mat3 uNMatrix;

out vec3 vLightWeighting;
out vec4 fragmentColor;

#define PI 3.14159265359

uniform sampler2D inPos;

void main(void) {
    int idx = int(gl_VertexID);

    int ip  = idx % 6;
    idx    /= 6;

    int it = idx % @{n1};
    idx    /= @{n1};


    int iz = idx % @{n2};
    idx    /= @{n2};

    // 1,4  5
    // 0    2,3


    if(ip == 1 || ip == 4 || ip == 5){
        iz++;
    }
    if(ip == 2 || ip == 3 || ip == 5){
        it++;
    }

    float z = sin(-PI/2.0 + PI * float(iz) / @{n1}.0);
    float r = sqrt(1.0 - z * z);
    float x = r * cos(2.0 * PI * float(it) / @{n2}.0);
    float y = r * sin(2.0 * PI * float(it) / @{n2}.0);

    float nx = x, ny = y, nz = z;

    fragmentColor = vec4(0.5, 0.5, 0.5, 5.0);

    vec3 pos = vec3(texelFetch(inPos, ivec2(idx, 0), 0));
    vec3 pos2 = pos + float(@{radius}) * vec3(x, y, z);

    gl_Position = uPMVMatrix * vec4(pos2, 1.0);

    vec3 transformedNormal = uNMatrix * vec3(nx, ny, nz);

    float directionalLightWeighting = max(dot(transformedNormal, uLightingDirection), 0.0);
    vLightWeighting = uAmbientColor + uDirectionalColor * directionalLightWeighting;
}`

} as unknown as PackageInfo;


function CubePkg(){
    return {
    params          : "",
    numInputFormula : "6 * 6",
    mode            : "TRIANGLES",
    fragmentShader  : gpgputs.GPGPU.planeFragmentShader,
    vertexShader    : `

${headShader}

void main(void) {
    int idx = int(gl_VertexID);

    int ip   = idx % 6;
    int face = idx / 6;

    // 1,4  5
    // 0    2,3

    float f[3];
    f[0] = (ip == 1 || ip == 4 || ip == 5 ? 1.0 : -1.0);
    f[1] = (ip == 2 || ip == 3 || ip == 5 ? 1.0 : -1.0);
    f[2] = (face % 2 == 0 ? -1.0 : 1.0);

    int i = face / 2;
    float x = f[i];
    float y = f[(i+1) % 3];
    float z = f[(i+2) % 3];

    float nx = 0.0, ny = 0.0, nz = 0.0;
    if(i == 0){
        nz = z;
    }
    else if(i == 1){
        ny = y;
    }
    else{
        nx = x;
    }

    fragmentColor = vec4(abs(ny), abs(nz), abs(nx), 0.3);

    ${tailShader}
}`

    } as unknown as PackageInfo;
}

}
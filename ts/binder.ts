namespace bansho {

declare let BathtubVortexShader: string;
declare let Viz : any;

let gpgpu: gpgputs.GPGPU;
let viz : any;
let varsAll : Variable[] = [];

let packageDlg: HTMLDialogElement;

let packages: gpgputs.Package[] = [];

export let pkgVertexShaderDiv: HTMLDivElement;

let srcVar : Variable | null = null;

let glbParamsInp          : HTMLInputElement;

let texEditDlg            : HTMLDialogElement;
let texShapeInp           : HTMLInputElement;
let texShapeValue         : HTMLElement;
let currentTex            : Variable;
let texTexelTypeSel       : HTMLSelectElement;

let pkgEditDlg            : HTMLDialogElement;
let pkgParamsInp          : HTMLInputElement;
let pkgNumInputFormulaInp : HTMLInputElement;
let pkgFragmentShaderSel  : HTMLSelectElement;
let currentPkg            : gpgputs.Package;

export function addTokenNode(div: HTMLDivElement, token: Token){
    if(token.typeTkn == TokenType.space){
                        
        // let txt = document.createTextNode(token.text);
        // div.appendChild(txt);

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
    id: string;
    package: gpgputs.Package;
    modifier: string;
    type: string;
    texelType: string | null = null;
    name: string;
    dstVars: Variable[] = [];
    shape: number[] = [];
    shapeFormula: string = "";

    constructor(pkg: gpgputs.Package, modifier: string, type: string, name: string){
        this.id = `${pkg.id}_${name}`;
        this.package  = pkg;
        this.modifier = modifier;
        this.type = type;
        this.name = name;
    }
}
function getIOVariables(pkg: gpgputs.Package){
    let vars: Variable[] = [];

    let tokens = Lex(pkg.vertexShader);
    tokens = tokens.filter(x => x.typeTkn != TokenType.space);

    for(let [i, token] of tokens.entries()){
        if(["uniform", "in", "out"].includes(token.text)){
            if(["uPMVMatrix", "uNMatrix", "tick", "fragmentColor", "gl_Position", "vLightWeighting"].includes(tokens[i + 2].text)){
                continue;
            }
            let iovar = new Variable(pkg, token.text, tokens[i + 1].text, tokens[i + 2].text);
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

//-------------------------------------------------- テクスチャ編集画面
function initTextureEditDlg(){
    texEditDlg      = getElement("tex-edit-dlg") as HTMLDialogElement;
    texShapeInp     = getElement("tex-shape") as HTMLInputElement;
    texShapeValue   = getElement("tex-shape-value");
    texTexelTypeSel = getElement("tex-texel-type") as HTMLSelectElement;

    texShapeInp.addEventListener("blur", function(ev: FocusEvent){
        let items = this.value.split(',');

        let map = getParamsMap([ glbParamsInp.value, currentTex.package.params ]);
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
        let map = getParamsMap([ glbParamsInp.value, currentTex.package.params ]);
        if(map == null){
            return;
        }

        let vals  = texShapeInp.value.split(',').map(x => parseMath(map!, x.trim()));
        if(vals.length < 1 || 3 < vals.length || vals.some(x => isNaN(x))){
            return;
        }
        if(vals.length == 1){
            vals = [1, vals[0]];
        }

        currentTex.shapeFormula = texShapeInp.value.trim();
        currentTex.shape = vals;
        currentTex.texelType = texTexelTypeSel.value;

        texEditDlg.close();        
    })
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

    if(tex.shapeFormula != ""){

        texShapeInp.value = tex.shapeFormula;
    }
    else if(tex.shape.length != 0){
        texShapeInp.value = tex.shape.map(x => `${x}`).join(", ");
    }
    else{
        texShapeInp.value = "";
    }
    texShapeValue.innerText = "";

    if(tex.texelType == null){
        texTexelTypeSel.selectedIndex = -1;
    }
    else{
        texTexelTypeSel.value = tex.texelType;
    }

    texEditDlg.showModal();
}

//-------------------------------------------------- パッケージ編集画面

function initPackageEditDlg(){
    pkgEditDlg            = getElement("pkg-edit-dlg") as HTMLDialogElement;
    pkgParamsInp          = getElement("pkg-params") as HTMLInputElement;
    pkgNumInputFormulaInp = getElement("pkg-numInput") as HTMLInputElement;
    pkgFragmentShaderSel  = getElement("pkg-fragment-shader") as HTMLSelectElement;
    pkgVertexShaderDiv    = getElement("pkg-vertex-shader") as HTMLDivElement;

    pkgParamsInp.addEventListener("blur", function(ev: FocusEvent){
        let map = getParamsMap([ glbParamsInp.value, pkgParamsInp.value]);
        pkgParamsInp.style.color = map == null ? "red" : "black";
    });

    pkgNumInputFormulaInp.addEventListener("blur", function(ev: FocusEvent){
        let val = NaN;

        let map = getParamsMap([ glbParamsInp.value, pkgParamsInp.value ]);
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

        let map = getParamsMap([ glbParamsInp.value, pkgParamsInp.value ]);
        if(map == null){
            return;
        }

        let val  = parseMath(map, numInputFormula);
        if(! isNaN(val)){

            currentPkg.params          = pkgParamsInp.value;
            currentPkg.numInputFormula = numInputFormula;
            currentPkg.numInput = val;

            pkgEditDlg.close();
        }
    });
}

function showPackageEditDlg(pkg: gpgputs.Package){
    currentPkg = pkg;

    pkgParamsInp.value   = pkg.params;

    if(pkg.numInputFormula != ""){

        pkgNumInputFormulaInp.value = pkg.numInputFormula;
    }
    else if(pkg.numInput != undefined){
        pkgNumInputFormulaInp.value = `${pkg.numInput}`;
    }
    else{
        pkgNumInputFormulaInp.value = "";
    }

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

    let varsAll_old = varsAll;
    varsAll = [];    
    for(let pkg of packages){
        let vars = getIOVariables(pkg);
        varsAll.push(...vars);

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
        let src_new = varsAll.find(x => x.id == src_old.id);
        if(src_new != undefined){
            src_new.texelType    = src_old.texelType;
            src_new.shapeFormula = src_old.shapeFormula;

            for(let dst_old of src_old.dstVars){
                let dst_new = varsAll.find(x => x.id == dst_old.id);
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
        let div = getElement("package-graph-div");
        if(div.firstChild != null){
            div.firstChild.remove();
        }

        div.appendChild(element);

        for(let pkg of packages){
            let dom = getElement(`${pkg.id}_vertex`);
            dom.addEventListener("click", function(ev: MouseEvent){

                let pkg1 = packages.find(x => this.id == `${x.id}_vertex`);
                if(pkg1 == undefined) throw new Error();

                showPackageEditDlg(pkg1);
            });
        }

        for(let va of varsAll){
            let dom = getElement(`${va.package.id}_${va.name}`);
            dom.addEventListener("click", function(ev: MouseEvent){
                if(ev.ctrlKey){
                }

                let va1 = varsAll.find(x => this.id == `${x.package.id}_${x.name}`);
                if(va1 == undefined) throw new Error();

                if(ev.ctrlKey){
                    if(srcVar == null){
                        srcVar = va1;
                    }
                    else{
                        srcVar.dstVars.push(va1);
                        if((va1.type == "sampler2D" || va1.type == "sampler3D") && va1.texelType == null){
                            va1.texelType = srcVar.type;
                            if(va1.shapeFormula == ""){

                                va1.shapeFormula = va1.package.numInputFormula;
                            }
                        }
                        srcVar = null;
                        makeGraph();
                    }
                }
                else{
                    if(va1.type == "sampler2D" || va1.type == "sampler3D"){
                        showTextureEditDlg(va1);
                    }
                }
            });
        }
    })
    .catch((error: any) => {
        // Create a new Viz instance (@see Caveats page for more info)
        viz = new Viz();

        // Possibly display the error
        console.error(error);
    });
}

export function initBinder(){
    getElement("open-package").addEventListener("click", (ev: MouseEvent)=>{
        packageDlg.showModal();
    });
    
    glbParamsInp = getElement("glb-params") as HTMLInputElement;
    glbParamsInp.addEventListener("blur", function(ev: FocusEvent){
        let map = getParamsMap([ glbParamsInp.value ]);
        glbParamsInp.style.color = map == null ? "red" : "black";
    });
    
    packageDlg = getElement("package-graph-dlg") as HTMLDialogElement;

    getElement("package-graph-ok").addEventListener("click", (ev: MouseEvent)=>{
        gpgpu.clearAll();
        packageDlg.close();
    })

    getElement("package-graph-cancel").addEventListener("click", (ev: MouseEvent)=>{
        gpgpu.clearAll();
        packageDlg.close();
    })

    initTextureEditDlg();

    initPackageEditDlg();

    //-------------------------------------------------- 3D編集画面

    var canvas = document.getElementById("package-canvas") as HTMLCanvasElement;
    gpgpu = gpgputs.CreateGPGPU(canvas);
    gl = gpgputs.gl;
    gpgpu.startDraw3D([ 
    ]);

    getElement("add-shape-pkg").addEventListener("click", (ev: MouseEvent)=>{
        let sel = getElement("sel-shape-pkg") as HTMLSelectElement;
        let pkg: gpgputs.Package;

        if(sel.value == "sphere"){
            pkg = makePkg(SpherePkg);
        }
        else{
            return;
        }

        packages.push(pkg);

        makeGraph();

    });

    getElement("add-package").addEventListener("click", (ev: MouseEvent)=>{
        let pkg = new gpgputs.Package({
            mode: gl.POINTS,
            vertexShader: BathtubVortexShader,
            fragmentShader: gpgputs.GPGPU.minFragmentShader,
            args: {}
        })
        
        packages.push(pkg);

        makeGraph();
    });

    // 適用ボタン クリック
    getElement("apply-graph").addEventListener("click", (ev: MouseEvent)=>{
        gpgpu.clearAll();

        for(let pkg of packages){
            if(pkg.numInput == undefined){
                throw new Error();
            }

            if(pkg.vertexShader.includes("@{")){
                pkg.vertexShaderTmpl = pkg.vertexShader;
            }
            if(pkg.vertexShaderTmpl != null){
                let map = getParamsMap([ glbParamsInp.value, pkg.params ]);
                if(map == null){
                    throw new Error();
                }

                let shader = pkg.vertexShaderTmpl;
                for(let [name, val] of Object.entries(map)){
                    let key = `@{${name}}`;
                    while(shader.includes(key)){
                        shader = shader.replace(key, `${val}`);
                    }
                }

                pkg.vertexShader = shader;
            }

            let vars = varsAll.filter(x => x.id.startsWith(`${pkg.id}_`));
            for(let va1 of vars){
                if(pkg.args[va1.name] == undefined){
                    if(va1.type == "sampler2D" || va1.type == "sampler3D"){

                        if(va1.texelType == null || va1.shape.length == 0){
                            throw new Error();
                        }

                        pkg.args[va1.name] = new gpgputs.TextureInfo(va1.texelType, va1.shape)
                    }
                    else{
                        pkg.args[va1.name] = new Float32Array( pkg.numInput * gpgputs.vecDim(va1.type) )
                    }
                }
            }

            gpgpu.makePackage(pkg);
        }

        for(let pkg of packages){
            let vars = varsAll.filter(x => x.id.startsWith(`${pkg.id}_`));
            for(let src of vars){

                for(let dst of src.dstVars){
                    pkg.bind(src.name, dst.name, dst.package);
                }
            }
        }

        gpgpu.drawables.push(...packages);
    });
    
    viz = new Viz();

    initCodeEditor();
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

class PackageTmpl {
    defaultParams!   : string;
    numInputFormula! : string;
    mode!            : string;
    fragmentShader!  : string;
    vertexShader!    : string;
}

function makePkg(tmpl: PackageTmpl) : gpgputs.Package {
    let pkg = new gpgputs.Package({
        params          : tmpl.defaultParams,
        numInputFormula : tmpl.numInputFormula,
        mode            : gpgputs.getDrawMode(tmpl.mode),
        fragmentShader  : tmpl.fragmentShader,
        vertexShader    : tmpl.vertexShader,
        args:{}
    });

    return pkg;
}

let SpherePkg = {
    defaultParams   : "n1 = 8, n2 = 8, radius = 0.04",
    numInputFormula : "INPUT * n1 * n2 * 6",
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

} as unknown as PackageTmpl;
}
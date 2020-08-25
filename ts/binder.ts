namespace bansho {

declare let BathtubVortexShader: string;
declare let Viz : any;

let gpgpu: gpgputs.GPGPU;
let viz : any;
let varsAll : Variable[] = [];

let packageDlg: HTMLDialogElement;
let divParts : HTMLDivElement;

let packages: gpgputs.Package[] = [];
let shaderEdit: HTMLDialogElement;
export let codeEditor: HTMLDivElement;
let srcVar : Variable | null = null;

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
    codeEditor.innerHTML= "";

    for(let line of text.split('\n')){
        let div = document.createElement("div");
        codeEditor.appendChild(div);

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

class Variable {
    id: string;
    package: gpgputs.Package;
    modifier: string;
    type: string;
    name: string;
    dstVars: Variable[] = [];

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

function makeGraph(){
    let texts : string[] = [];

    let varsAll_old = varsAll;
    varsAll = [];    
    let shape = getShape();
    for(let pkg of packages){
        pkg.setShape(shape);
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

                setCode(pkg1.vertexShader);
                shaderEdit.showModal();
                console.log(`pkg.id click`);
            });
        }

        for(let va of varsAll){
            let dom = getElement(`${va.package.id}_${va.name}`);
            dom.addEventListener("click", function(ev: MouseEvent){
                if(! ev.ctrlKey){
                    return;
                }

                let va1 = varsAll.find(x => this.id == `${x.package.id}_${x.name}`);
                if(va1 == undefined) throw new Error();

                if(srcVar == null){
                    srcVar = va1;
                }
                else{
                    srcVar.dstVars.push(va1);
                    srcVar = null;
                    makeGraph();
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

function getShape(){
    let inp = getElement("shader-shape") as HTMLInputElement;
    let shape = inp.value.split(',');
    return shape.map(x => parseInt(x.trim()));
}

function getSize(shape: number[]){
    return shape.reduce((x,y)=>(x * y), 1);
}

export function initBinder(){
    getElement("open-package").addEventListener("click", (ev: MouseEvent)=>{
        packageDlg.showModal();
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

    shaderEdit = getElement("shader-edit-dlg") as HTMLDialogElement;
    codeEditor = getElement("code-editor") as HTMLDivElement;

    var canvas = document.getElementById("package-canvas") as HTMLCanvasElement;
    gpgpu = gpgputs.CreateGPGPU(canvas);
    gl = gpgputs.gl;
    gpgpu.startDraw3D([ 
    ]);

    divParts = getElement("package-parts") as HTMLDivElement;

    getElement("add-shape-pkg").addEventListener("click", (ev: MouseEvent)=>{
        let sel = getElement("sel-shape-pkg") as HTMLSelectElement;
        let pkg: gpgputs.Package;

        if(sel.value == "sphere"){
            pkg = new SpherePkg();
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

    getElement("add-slider").addEventListener("click", (ev: MouseEvent)=>{
        let div = getElement("slider-tmpl").cloneNode(true) as HTMLDivElement;
        div.style.display = "inline-block";

        divParts.appendChild(div);
    });


    getElement("apply-graph").addEventListener("click", (ev: MouseEvent)=>{
        gpgpu.clearAll();

        let shape = getShape();
        for(let pkg of packages){
            pkg.setShape(shape);
            let vars = varsAll.filter(x => x.id.startsWith(`${pkg.id}_`));
            for(let va1 of vars){
                if(pkg.args[va1.name] == undefined){
                    if(va1.type == "sampler2D" || va1.type == "sampler3D"){

                        let src = varsAll.find(x => x.dstVars.includes(va1));
                        if(src == undefined) throw new Error();

                        let tex_shape = (pkg.shape.length == 1 ? [1, pkg.shape[0]] : pkg.shape);
                        pkg.args[va1.name] = new gpgputs.TextureInfo(src.type, tex_shape)
                    }
                    else{
                        pkg.args[va1.name] = new Float32Array( getSize(pkg.shape) * gpgputs.vecDim(va1.type) )
                    }
                }
            }

            if(pkg.numInput == undefined){
                pkg.numInput = getSize(pkg.shape);
            }

            gpgpu.makePackage(pkg);

            for(let src of vars){
                for(let dst of src.dstVars){
                    pkg.bind(src.name, dst.name, dst.package);
                }
            }
        }

        gpgpu.drawables.push(...packages);
    });
    
    viz = new Viz();

    initCodeEditor(shaderEdit);
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

export class SpherePkg extends gpgputs.UserDef {
    constructor(){
        super(bansho.gl.TRIANGLES, "", gpgputs.GPGPU.planeFragmentShader, {});
    }

    setShape(shape: number[]){
        super.setShape(shape);

        let n1 = 8, n2 = 8, radius = 0.04;
        let cnt = getSize(shape);
        let [ sy, sx ] = Factorization(cnt);
        console.log(`粒子 因数分解 ${cnt} = ${sy} x ${sx}`);

        let shader = `

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

    int it = idx % ${n1};
    idx    /= ${n1};


    int iz = idx % ${n2};
    idx    /= ${n2};

    // 1,4  5
    // 0    2,3

    int col  = idx % ${sx};
    int row  = idx / ${sx};

    if(ip == 1 || ip == 4 || ip == 5){
        iz++;
    }
    if(ip == 2 || ip == 3 || ip == 5){
        it++;
    }

    float z = sin(-PI/2.0 + PI * float(iz) / ${n1}.0);
    float r = sqrt(1.0 - z * z);
    float x = r * cos(2.0 * PI * float(it) / ${n2}.0);
    float y = r * sin(2.0 * PI * float(it) / ${n2}.0);

    float nx = x, ny = y, nz = z;

    fragmentColor = vec4(0.5, 0.5, 0.5, 5.0);

    vec3 pos = vec3(texelFetch(inPos, ivec2(col, row), 0));
    vec3 pos2 = pos + float(${radius}) * vec3(x, y, z);

    gl_Position = uPMVMatrix * vec4(pos2, 1.0);

    vec3 transformedNormal = uNMatrix * vec3(nx, ny, nz);

    float directionalLightWeighting = max(dot(transformedNormal, uLightingDirection), 0.0);
    vLightWeighting = uAmbientColor + uDirectionalColor * directionalLightWeighting;
}`;

        this.vertexShader = shader;

        this.args.inPos = new gpgputs.TextureInfo("vec3" , [sy, sx], new Float32Array(cnt * 3));
        this.numInput = cnt * n1 * n2 * 6;
    }
}
}
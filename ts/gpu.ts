/// <reference path="@types/shape.d.ts" />

namespace bansho {
export let gl : WebGL2RenderingContext;

export const headShader = `
const vec3 uAmbientColor = vec3(0.2, 0.2, 0.2);
const vec3 uLightingDirection =  normalize( vec3(0.25, 0.25, 1) );
const vec3 uDirectionalColor = vec3(0.8, 0.8, 0.8);

uniform mat4 uPMVMatrix;
uniform mat3 uNMatrix;

out vec3 vLightWeighting;
out vec4 fragmentColor;

#define PI 3.14159265359
`;

export const tailShader = `
    gl_Position = uPMVMatrix * vec4(x, y, z, 1.0);

    vec3 transformedNormal = uNMatrix * vec3(nx, ny, nz);

    float directionalLightWeighting = max(dot(transformedNormal, uLightingDirection), 0.0);
    vLightWeighting = uAmbientColor + uDirectionalColor * directionalLightWeighting;
`;

export function sphereShader(n1: number, n2: number){ 
    return `
${headShader}

void main(void) {
    int idx = int(gl_VertexID);

    int ip  = idx % 6;
    idx    /= 6;

    int it = idx % ${n1};
    int iz = idx / ${n1};
    // 1,4  5
    // 0    2,3

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

    fragmentColor = vec4(abs(nx), abs(ny), abs(nz), 0.3);

    ${tailShader}

}`;
}

function spherePoints(n1: number, n2: number){ 
    return `
uniform mat4 uPMVMatrix;
uniform float pointSize;
uniform int   tick;

in  vec4 A;
out vec4 B;

out vec4 fragmentColor;

#define PI 3.14159265359
    
void main(void) {
    int idx = int(gl_VertexID);

    int it = idx % ${n1};
    int iz = idx / ${n1};

    float x, y, z;
    if(tick == 0){

        z = sin(-PI/2.0 + PI * float(iz) / ${n1}.0);
        float r = sqrt(1.0 - z * z);
        x = r * cos(2.0 * PI * float(it) / ${n2}.0);
        y = r * sin(2.0 * PI * float(it) / ${n2}.0);
    }
    else{

        x = A.x + 0.001 * cos(float(tick) / 100.0);
        y = A.y + 0.001 * sin(float(tick) / 100.0);
        z = A.z + 0.001 * sin(float(tick) / 100.0);
    }

    fragmentColor = vec4(abs(x), abs(y), abs(z), 1.0);

    gl_PointSize  = pointSize;
    gl_Position   = uPMVMatrix * vec4(x, y, z, 1.0);
    B             = vec4(x, y, z, 1.0);
}`;
}



function Tetrahedron(){
    let x = Math.cos(Math.PI / 6.0);
    let y = Math.sin(Math.PI / 6.0);

    return `
    ${headShader}

    const int ipos[12] = int[12]( 0, 1, 2, 0, 2, 3, 0, 3, 1, 1, 2, 3 );
    // int ipos[12];

    const vec3 pos[4]=vec3[4](
        vec3(  0.0,   0.0, 1.0),
        vec3(-${x}, -${y}, 0.0),
        vec3( ${x}, -${y}, 0.0),
        vec3(  0.0,   1.0, 0.0) 
    );    
    
    void main(void) {
        int idx = int(gl_VertexID);
    
        int ip   = idx % 3;
        int face = idx / 3;

        int i = ipos[idx];

        float x = pos[i].x;
        float y = pos[i].y;
        float z = pos[i].z;

        int j  = face * 3;
        vec3 e = normalize(cross(pos[j + 1] - pos[j], pos[j + 2] - pos[j]));
    
        float nx = e.x, ny = e.y, nz = e.z;
    
        fragmentColor = vec4(abs(nz), abs(nx), abs(ny), 0.3);
    
        ${tailShader}
    
    }`;
}

function CubeShader(){ 
    return `
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
}`;
}


function LineShader(len: number){ 
    return `
${headShader}

uniform int   tick;

void main(void) {
    int idx = int(gl_VertexID) + tick % ${len};


    float theta = 5.0 * PI * float(idx) / float(${len});
    float x = 1.2 * cos(theta);
    float y = 1.2 * sin(theta);
    float z = 0.5 * float(idx) / float(${len});

    fragmentColor = vec4(abs(x), abs(y), abs(z), 1.0);

    gl_PointSize  = 5.0;
    gl_Position = uPMVMatrix * vec4(x, y, z, 1.0);
}`;
}

/*
*/

function ArrowShader(nrow: number, ncol: number){ 
    return `
${headShader}

uniform int   tick;

//void calc(float u, float v, out float x, out float y, out float z){
void calc(float u, float v, out vec3 p){
    p.x = sin(u) * cos(v);
    p.y = sin(u) * sin(v);
    p.z = cos(u);
}    

void main(void) {
    int idx = int(gl_VertexID);

    int ip  = idx % 4;
    idx /= 4;

    int row  = idx / ${ncol};
    int col  = idx % ${ncol};

    float u =       PI * float(row) / float(${nrow});
    float v = 2.0 * PI * float(col) / float(${ncol});

    vec3 p;
    calc(u, v, p);
    float x = p.x, y = p.y, z = p.z;

    if(ip == 1 || ip == 3){
        vec3 p2 = normalize(vec3(y - z, z - x, x - y));

        if(ip == 3){
            p2 = normalize(cross(p, p2));
        }

        x += 0.1 * p2.x;
        y += 0.1 * p2.y;
        z += 0.1 * p2.z;
    }

    fragmentColor = vec4(abs(x), abs(y), abs(z), 1.0);

    gl_PointSize  = 5.0;
    gl_Position = uPMVMatrix * vec4(x, y, z, 1.0);
}`;
}

export function initSample3D(){
    const sel = document.getElementById("sample-3d") as HTMLSelectElement;
    const names = [
        "円",
        "管",
        "円柱",
        "円錐",
        "点",
        "線",
        "正二十面体",
        "測地線多面体1",
        "測地線多面体2",
        "測地線多面体3",
        "測地線多面体4",
        "点",
        "線-LINE",
        "線-POINTS",
        "球",
        "正四面体",
        "三角錐",
        "矢印",
    ];

    for(let name of names){
        let opt = document.createElement("option");
        opt.innerText = name;
        sel.appendChild(opt);
    }    

    sel.addEventListener("input", (ev: Event)=>{
        console.log(`sel input ${sel.selectedIndex}`);

        if(glb.view != null && glb.view.gpgpu != null){

            while(glb.view.gpgpu.drawables.length != 0){
                let old = glb.view.gpgpu!.drawables.pop()!;
                if(old.package != undefined){

                    old.package.clear();
                }
                else{

                    if(old instanceof gpgputs.ComponentDrawable){
                        old.children.forEach(x => x.package.clear());
                    }
                    else{
                        console.log("clear err");
                    }
                }
            }

            let drawable = getSample3D(sel.selectedIndex);
            glb.view.gpgpu.drawables.push(drawable)
        }
    })
}

function getSample3D(idx: number) : gpgputs.Drawable {
    switch(idx){
        case 0: return (new gpgputs.Circle(new gpgputs.Color(1,0,0,1), 20)).scale(0.2, 0.1, 0.2).move(1, 0, 0.5);
        case 1: return (new gpgputs.Tube(new gpgputs.Color(0,1,0,1), 20)).scale(0.1, 0.1, 2).move(-1, 0, 0);
        case 2: return (new gpgputs.Pillar([gpgputs.Color.red, gpgputs.Color.green, gpgputs.Color.blue], 20)).scale(0.1, 0.1, 1).move(0, 3, 0);
        case 3: return (new gpgputs.Cone(gpgputs.Color.red, 20)).scale(0.2, 0.2, 1).move(2, 0, 0.5);
        case 4: return new gpgputs.Points(new Float32Array([1.5, -1.3, 0, -1.5, -1.3, 0]), new Float32Array([1,0,0,1, 0,0,1,1]), 5);
        case 5: return new gpgputs.Lines([{x:1.5,y:-1.5,z:0} as gpgputs.Vertex,{x:-1.5,y:-1.5,z:0} as gpgputs.Vertex], gpgputs.Color.blue);
        case 6: return (new gpgputs.RegularIcosahedron(new gpgputs.Color(0,1,0,1))).scale(0.3, 0.3, 0.3).move(2, -2, 0);
        case 7: return (new gpgputs.GeodesicPolyhedron(new gpgputs.Color(0,0,1,1), 1)).scale(0.3, 0.3, 0.3).move(3,  2, 0);
        case 8: return (new gpgputs.GeodesicPolyhedron(new gpgputs.Color(0,0,1,1), 2)).scale(0.3, 0.3, 0.3).move(1.5,  1, 0);
        case 9: return (new gpgputs.GeodesicPolyhedron(new gpgputs.Color(0,0,1,1), 3)).scale(0.3, 0.3, 0.3).move(-1.5, -1, 0);
        case 10: return (new gpgputs.GeodesicPolyhedron(new gpgputs.Color(0,0,1,1), 4)).scale(0.3, 0.3, 0.3).move(-3, -2, 0);
        case 11: return new gpgputs.UserPoints(spherePoints(32, 32) , gpgputs.GPGPU.pointFragmentShader,
            {
                pointSize: 5,
                A : new Float32Array(32 * 32 * 4),
                B : new Float32Array(32 * 32 * 4)
            }, 
            (self:gpgputs.UserPoints)=>{
                let B = (self.package.args as any).B as Float32Array;
                (self.package.args as any).A = B.slice();
            });
        case 12: return new gpgputs.UserLine(gl.LINE_STRIP, LineShader(32), gpgputs.GPGPU.pointFragmentShader, 32);
        case 13: return new gpgputs.UserLine(gl.POINTS, LineShader(512), gpgputs.GPGPU.pointFragmentShader, 512);
        case 14: return new gpgputs.UserSurface(sphereShader(64, 64), gpgputs.GPGPU.planeFragmentShader, 64 * 64 * 6);
        case 15: return new gpgputs.UserSurface(CubeShader()        , gpgputs.GPGPU.planeFragmentShader, 6 * 6);
        case 16: return new gpgputs.UserSurface(Tetrahedron()       , gpgputs.GPGPU.planeFragmentShader, 4 * 3).move(0, 1, 0);
        case 17: return new gpgputs.UserLine(gl.LINES, ArrowShader(8, 16), gpgputs.GPGPU.pointFragmentShader, 8 * 16 * 4);
    }
    throw new Error();
}


export function make3D(canvas: HTMLCanvasElement){
    let gpgpu = gpgputs.CreateGPGPU(canvas);
    gl = gpgputs.gl;

    gpgpu.startDraw3D([]);

    return gpgpu;
}

export function testGpgpu(){
    // gpgputs.testBodyOnLoad();

    var canvas = document.getElementById("webgl-canvas") as HTMLCanvasElement;
    make3D(canvas);
}


}
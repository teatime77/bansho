/// <reference path="@types/shape.d.ts" />

declare function volumeWave(sx: number, sy: number, sz: number) : string;
declare function ArrowWave(sx: number, sy: number, sz: number): string;
declare function ArrowTest(gpgpu: gpgputs.GPGPU) : gpgputs.Drawable;
declare function testEMWave(gpgpu: gpgputs.GPGPU) : gpgputs.Drawable;
declare function multibodyTest(gpgpu: gpgputs.GPGPU) : gpgputs.Drawable;
declare function ElasticCollision(gpgpu: gpgputs.GPGPU) : gpgputs.Drawable;
declare function CubeShader() : string;
declare function InverseSquare(gpgpu: gpgputs.GPGPU) : gpgputs.Drawable;
declare function BathtubVortex(gpgpu: gpgputs.GPGPU) : gpgputs.Drawable;
declare function testSurface(gpgpu: gpgputs.GPGPU) : gpgputs.Drawable;

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


function spherePointsTex(n1: number, n2: number){ 
    return `
uniform mat4  uPMVMatrix;
uniform float pointSize;
uniform int   tick;

uniform sampler2D A;
out vec4 B;

out vec4 fragmentColor;

#define PI 3.14159265359
    
void main(void) {
    int idx = int(gl_VertexID);

    int it = idx % ${n1};
    int iz = idx / ${n1};

    float x, y, z;
    if(it == 0 && iz == 0){

        z = 1.0 + 0.2 * cos(float(tick) / 100.0);
        x = 0.0;
        y = 0.0;
    }
    else{
        if(tick == 0){

            z = cos(PI * float(iz) / ${n1}.0);
            float r = sqrt(1.0 - z * z);
            x = r * cos(2.0 * PI * float(it) / ${n2}.0);
            y = r * sin(2.0 * PI * float(it) / ${n2}.0);
        }
        else{

            // Aのrow行i列の値を取得します。
            vec4 a = texelFetch(A, ivec2(it, iz), 0);

            x = a.x + 0.001 * cos(float(tick) / 100.0);
            y = a.y + 0.001 * sin(float(tick) / 100.0);
            z = a.z + 0.001 * sin(float(tick) / 100.0);
        }
    }

    fragmentColor = vec4(abs(x), abs(y), abs(z), 1.0);

    gl_PointSize  = pointSize;
    gl_Position   = uPMVMatrix * vec4(x, y, z, 1.0);
    B             = vec4(x, y, z, 1.0);
}`;
}


function stringPoints(n1: number, K: number){ 
    return `
uniform mat4  uPMVMatrix;
uniform float pointSize;
uniform int   tick;

uniform sampler2D inPos;
uniform sampler2D inVel;
out vec4 outPos;
out vec4 outVel;

out vec4 fragmentColor;

#define PI 3.14159265359
    
void main(void) {
    float L = 3.2 / float(${n1});
    float K = float(${K});

    int idx = int(gl_VertexID);

    vec4 vel = vec4(0.0, 0.0, 0.0, 0.0);

    float x = -1.6 + float(idx) * L;
    float y = 0.0;
    float z = 0.0;

    if(idx == 0){

        y = 0.2 * cos(float(tick) / 100.0);
        // y = 0.0;
    }
    else if(idx == ${n1 - 1}){

        y = 0.0;
    }
    else{
        if(tick == 0){

            vec4 p  = texelFetch(inPos, ivec2(idx    , 0), 0);
            y = p.y;
        }
        else{

            vec4 p1 = texelFetch(inPos, ivec2(idx - 1, 0), 0);
            vec4 p  = texelFetch(inPos, ivec2(idx    , 0), 0);
            vec4 p2 = texelFetch(inPos, ivec2(idx + 1, 0), 0);

            vel  = texelFetch(inVel, ivec2(idx, 0), 0);

            float l1 = length(p1 - p);
            float f1 = K * (l1 - L);
            float a1 = f1 * ((p1.y - p.y) / l1);

            float l2 = length(p2 - p);
            float f2 = K * (l2 - L);
            float a2 = f2 * ((p2.y - p.y) / l2);

            vel.y += a1 + a2;

            y = p.y + vel.y;
        }
    }

    // fragmentColor = vec4(abs(x), abs(y), abs(z), 1.0);
    fragmentColor = vec4(0.0, 0.0, 1.0, 1.0);

    gl_PointSize  = pointSize;
    gl_Position   = uPMVMatrix * vec4(x, y, z, 1.0);
    outPos        = vec4(x, y, z, 1.0);
    outVel        = vel;
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


function LineShader(len: number){ 
    return `
uniform mat4 uPMVMatrix;
out vec4 fragmentColor;

#define PI 3.14159265359

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

function ArrowShader(nrow: number, ncol: number){ 
    return `
uniform mat4 uPMVMatrix;
uniform mat3 uNMatrix;
uniform int   tick;

out vec4 fragmentColor;

#define PI 3.14159265359

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



function initSample3D(gpgpu: gpgputs.GPGPU){
    const sel = document.getElementById("sample-3d") as HTMLSelectElement;
    const names = [
        "円",
        "管",
        "円柱",
        "矢印",
        "点",
        "線",
        "正二十面体",
        "測地線多面体1",
        "測地線多面体2",
        "バスタブ渦",
        "逆二乗",
        "点",
        "線-LINE",
        "線-POINTS",
        "球",
        "正四面体",
        "三角錐",
        "矢印",
        "多体問題",
        "線-Tex",
        "弦",
        "面",
        "電磁波",
        "弾性衝突",
    ];

    for(let name of names){
        let opt = document.createElement("option");
        opt.innerText = name;
        sel.appendChild(opt);
    }    

    sel.addEventListener("input", (ev: Event)=>{
        gpgpu.clearAll();

        let drawable = getSample3D(gpgpu, sel.selectedIndex);
        gpgpu.drawables.push(drawable)
    })
}


function getSample3D(gpgpu: gpgputs.GPGPU, idx: number) : gpgputs.AbsDrawable {
    gpgpu.drawParam = new gpgputs.DrawParam(0, 0, 0, 0, -5.0);

    switch(idx){
        // 円
        case 0: return (new gpgputs.Circle(new gpgputs.Color(1,0,0,1), 20)).scale(0.2, 0.1, 0.2).move(1, 0, 0.5);
        // 管
        case 1: return (new gpgputs.Tube(new gpgputs.Color(0,1,0,1), 20)).scale(0.1, 0.1, 2).move(-1, 0, 0);
        // 円柱
        case 2: return (new gpgputs.Pillar([gpgputs.Color.red, gpgputs.Color.green, gpgputs.Color.blue], 20)).scale(0.1, 0.1, 1).move(0, 3, 0);
        // 矢印
        case 3: return ArrowTest(gpgpu);
        // 点
        case 4: return new gpgputs.Points(new Float32Array([1.5, -1.3, 0, -1.5, -1.3, 0]), new Float32Array([1,0,0,1, 0,0,1,1]), 5);
        // 線
        case 5: return new gpgputs.Lines([{x:1.5,y:-1.5,z:0} as gpgputs.Vertex,{x:-1.5,y:-1.5,z:0} as gpgputs.Vertex], gpgputs.Color.blue);
        // 正二十面体
        case 6: return (new gpgputs.RegularIcosahedron(new gpgputs.Color(0,1,0,1))).scale(0.3, 0.3, 0.3).move(2, -2, 0);
        // 測地線多面体1
        case 7: return (new gpgputs.GeodesicPolyhedron(new gpgputs.Color(0,0,1,1), 1)).scale(0.3, 0.3, 0.3).move(3,  2, 0);
        // 測地線多面体2
        case 8: return (new gpgputs.GeodesicPolyhedron(new gpgputs.Color(0,0,1,1), 2)).scale(0.3, 0.3, 0.3).move(1.5,  1, 0);
        // バスタブ渦
        case 9: return BathtubVortex(gpgpu);
        // 逆二乗
        case 10: return InverseSquare(gpgpu);
        // 点
        case 11: { let dr = new gpgputs.UserDef(gl.POINTS, spherePoints(32, 32) , gpgputs.GPGPU.pointFragmentShader,
            {
                pointSize: 5,
                A : new Float32Array(32 * 32 * 4),
                B : new Float32Array(32 * 32 * 4)
            });
            gpgpu.makePackage(dr);
            dr.bind("B", "A");
            return dr;
        }
        // 線-LINE
        case 12: return new gpgputs.UserMesh(gl.LINE_STRIP, LineShader(32), gpgputs.GPGPU.pointFragmentShader, 32);
        // 線-POINTS
        case 13: return new gpgputs.UserMesh(gl.POINTS, LineShader(512), gpgputs.GPGPU.pointFragmentShader, 512);
        // 球
        case 14: return new gpgputs.UserMesh(gl.TRIANGLES, sphereShader(64, 64), gpgputs.GPGPU.planeFragmentShader, 64 * 64 * 6);
        // 正四面体
        case 15: return new gpgputs.UserMesh(gl.TRIANGLES, CubeShader()        , gpgputs.GPGPU.planeFragmentShader, 6 * 6);
        // 三角錐
        case 16: return new gpgputs.UserMesh(gl.TRIANGLES, Tetrahedron()       , gpgputs.GPGPU.planeFragmentShader, 4 * 3).move(0, 1, 0);
        // 矢印
        case 17: return new gpgputs.UserMesh(gl.LINES, ArrowShader(8, 16), gpgputs.GPGPU.pointFragmentShader, 8 * 16 * 4);
        // 多体問題
        case 18: return multibodyTest(gpgpu);
        // 線-Tex
        case 19: { let dr = new gpgputs.UserDef(gl.POINTS, spherePointsTex(32, 32) , gpgputs.GPGPU.pointFragmentShader,
            {
                pointSize: 5,
                A : gpgpu.makeTextureInfo("vec4", [32, 32]),
                B : new Float32Array(32 * 32 * 4)
            });
            dr.numInput = 32 * 32;
            gpgpu.makePackage(dr);
            dr.bind("B", "A");
            return dr;
        }
        // 弦
        case 20: { 
            const sz = 4096;
            let inPos = (new Float32Array(sz * 4)).map(x => 0.4 * Math.random() - 0.2);
            inPos = new Float32Array(sz * 4);
            let dr = new gpgputs.UserDef(gl.POINTS, stringPoints(sz, 0.9) , gpgputs.GPGPU.pointFragmentShader,
            {
                pointSize: 5,
                inPos : gpgpu.makeTextureInfo("vec4", [1, sz], inPos),
                inVel : gpgpu.makeTextureInfo("vec4", [1, sz]),
                outPos: new Float32Array(sz * 4),
                outVel: new Float32Array(sz * 4)
            });
            dr.numInput = sz;
            gpgpu.makePackage(dr);
            dr.bind("outPos", "inPos");
            dr.bind("outVel", "inVel");
            return dr;
        }
        // 面
        case 21: return testSurface(gpgpu);
        // 電磁波
        case 22: return testEMWave(gpgpu);
        // 弾性衝突
        case 23: return ElasticCollision(gpgpu);
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
    var canvas = document.getElementById("webgl-canvas") as HTMLCanvasElement;
    let gpgpu = make3D(canvas);

    initSample3D(gpgpu);
}


}
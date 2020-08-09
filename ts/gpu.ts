/// <reference path="@types/shape.d.ts" />

declare let PseudoColor: string;
declare function volumeWave(sx: number, sy: number, sz: number) : string;
declare function ArrowWave(sx: number, sy: number, sz: number): string;

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


function surfaceWave(sz: number, K: number){ 
    return `
const vec3 uAmbientColor = vec3(0.2, 0.2, 0.2);
const vec3 uLightingDirection =  normalize( vec3(0.25, 0.25, 1) );
const vec3 uDirectionalColor = vec3(0.8, 0.8, 0.8);

uniform mat4 uPMVMatrix;
uniform mat3 uNMatrix;
    
uniform float pointSize;
uniform int   tick;
    
uniform sampler2D inPos;
uniform sampler2D inVel;
out vec4 outPos;
out vec4 outVel;

out vec4 fragmentColor;

#define PI 3.14159265359

${PseudoColor}

void main(void) {
    float L = 3.2 / float(${sz});
    float K = float(${K});

    int idx = int(gl_VertexID);

    int row  = idx / ${sz};
    int col  = idx % ${sz};

    vec4 vel = vec4(0.0, 0.0, 0.0, 0.0);

    float x = -1.6 + float(col) * L;
    float y = -1.6 + float(row) * L;
    float z = 0.0;

    vec3 nv = vec3(0.0, 0.0, 1.0);

    if(row == ${sz} / 2 && col == ${sz} / 2){

        z = 0.2 * cos(float(tick) / 100.0);
    }
    else if(col == 0 || row == 0 || col == ${sz} - 1 || row == ${sz} - 1){
        z = 0.0;
    }
/*
    else if(row == 0         && col == 0         ||
            row == 0         && col == ${sz} - 1 || 
            row == ${sz} - 1 && col == 0         || 
            row == ${sz} - 1 && col == ${sz} - 1){

        z = 0.0;
    }
*/
    else{
        if(tick == 0){

            vec4 p  = texelFetch(inPos, ivec2(col, row), 0);
            z = p.z;
        }
        else{

            vec4 p  = texelFetch(inPos, ivec2(col, row), 0);
            vel     = texelFetch(inVel, ivec2(col, row), 0);

            float dzx = 0.0, dzy = 0.0;
            float sum_a = 0.0;
            for(int i = 0; i < 4; i++){
                int col1 = col, row1 = row;

                switch(i){
                case 0: col1--; break;
                case 1: col1++; break;
                case 2: row1--; break;
                case 3: row1++; break;
                }

                if(col1 < 0 || row1 < 0 || col1 == ${sz} || row1 == ${sz}){
                    continue;
                }

                vec4 p1 = texelFetch(inPos, ivec2(col1, row1), 0);

                float l1 = length(p1 - p);
                l1 = sqrt(2.0 * L * L + (p1.z - p.z) * (p1.z - p.z));
                float f1 = K * (l1 - L);
                float a1 = f1 * ((p1.z - p.z) / l1);

                switch(i){
                case 0: dzx += p.z  - p1.z; break;
                case 1: dzx += p1.z - p.z; break;
                case 2: dzy += p.z  - p1.z; break;
                case 3: dzy += p1.z - p.z; break;
                }

                vec3 vx = vec3(2.0 * L, 0.0    , dzx);
                vec3 vy = vec3(0.0    , 2.0 * L, dzy);

                nv = normalize(cross(vx, vy));

                if(isnan(a1)){
                    continue;
                }
                
                sum_a += a1;
            }

            vel.z += sum_a;

            z = p.z + vel.z;
            // z = p.z;
        }
    }

    vec3 transformedNormal = uNMatrix * nv;

    float directionalLightWeighting = max(dot(transformedNormal, uLightingDirection), 0.0);
    vec3 vLightWeighting = uAmbientColor + uDirectionalColor * directionalLightWeighting;

    vec3 pcolor   = PseudoColor(-0.2, 0.2, z);
    // vec3 pcolor   = PseudoColor(-1.6, 1.6, x);
    fragmentColor = vec4(pcolor * vLightWeighting, 1.0);

    // fragmentColor = vec4(abs(x), abs(y), abs(z), 1.0);
    // fragmentColor = vec4(0.0, 0.0, 1.0, 1.0);

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

function ArrowFanShader(nrow: number, ncol: number, npt: number){ 
    return `
${headShader}

uniform int   tick;

void calc(float u, float v, out vec3 p){
    p.x = sin(u) * cos(v);
    p.y = sin(u) * sin(v);
    p.z = cos(u);
}    

void main(void) {
    int idx = int(gl_VertexID);

    int ip  = idx % ${npt};
    idx /= ${npt};

    int mod = idx % 3;
    idx /= 3;

    int row  = idx / ${ncol};
    int col  = idx % ${ncol};

    float u =       PI * float(row) / float(${nrow});
    float v = 2.0 * PI * float(col) / float(${ncol});

    vec3 p0;
    calc(u, v, p0);
    vec3 p1 = 0.9 * p0;
    vec3 p2 = 0.8 * p0;

    float x, y, z;
    vec3 nv;

    if(ip == 0){
        
        if(mod == 0){

            x = p2.x;
            y = p2.y;
            z = p2.z;

            nv = normalize(p2 - p1);
        }
        else if(mod == 1){

            x = p1.x;
            y = p1.y;
            z = p1.z;

            nv = normalize(p1 - p2);
        }
        else{

            x = p0.x;
            y = p0.y;
            z = p0.z;

            nv = normalize(p0 - p1);
        }

    }
    else{
        vec3 e1 = normalize(vec3(p1.y - p1.z, p1.z - p1.x, p1.x - p1.y));

        vec3 e2 = normalize(cross(p1, e1));

        float theta = 2.0 * PI * float(ip - 1) / float(${npt - 2});

        float r;

        vec3 p3;

        if(mod != 2){

            r = 0.05;
            p3 = p1 + r * cos(theta) * e1 + r * sin(theta) * e2;
        }
        else{

            r = 0.025;
            p3 = p0 + r * cos(theta) * e1 + r * sin(theta) * e2;
        }

        if(mod == 0){
            // 角錐の場合

            nv = normalize(p3 - p1);
        }
        else{
            // 円の場合

            nv = normalize(p0 - p1);
        }

        x = p3.x;
        y = p3.y;
        z = p3.z;

    }

    float nx = nv.x, ny = nv.y, nz = nv.z;

    // fragmentColor = vec4(abs(ny), abs(nz), abs(nx), 1.0);
    fragmentColor = vec4(0.5, 0.5, 0.5, 1.0);

    ${tailShader}
}`;
}


function ArrowTubeShader(nrow: number, ncol: number, npt: number){ 
    return `
${headShader}

uniform int   tick;

void calc(float u, float v, out vec3 p){
    p.x = sin(u) * cos(v);
    p.y = sin(u) * sin(v);
    p.z = cos(u);
}    

void main(void) {
    int idx = int(gl_VertexID);

    int lh  = idx % 2;
    idx /= 2;

    int ip  = idx % ${npt};
    idx /= ${npt};

    int row  = idx / ${ncol};
    int col  = idx % ${ncol};

    float u =       PI * float(row) / float(${nrow});
    float v = 2.0 * PI * float(col) / float(${ncol});

    vec3 p0;
    calc(u, v, p0);
    vec3 p1 = 0.9 * p0;

    float x, y, z;
    vec3 nv;

    vec3 e1 = normalize(vec3(p1.y - p1.z, p1.z - p1.x, p1.x - p1.y));

    vec3 e2 = normalize(cross(p1, e1));

    float theta = 2.0 * PI * float(ip - 1) / float(${npt - 2});

    vec3 p3;

    float r = 0.025;
    if(lh == 0){

        p3 = p0 + r * cos(theta) * e1 + r * sin(theta) * e2;
        nv = normalize(p3 - p0);
    }
    else{

        p3 = p1 + r * cos(theta) * e1 + r * sin(theta) * e2;
        nv = normalize(p3 - p1);
    }

    x = p3.x;
    y = p3.y;
    z = p3.z;

    float nx = nv.x, ny = nv.y, nz = nv.z;

    // fragmentColor = vec4(abs(ny), abs(nz), abs(nx), 1.0);
    fragmentColor = vec4(0.5, 0.5, 0.5, 1.0);

    ${tailShader}
}`;
}

export function initSample3D(){
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
        "測地線多面体3",
        "測地線多面体4",
        "点",
        "線-LINE",
        "線-POINTS",
        "球",
        "正四面体",
        "三角錐",
        "矢印",
        "角錐",
        "線-Tex",
        "弦",
        "面",
        "電磁波",
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

            let drawable = getSample3D(glb.view.gpgpu, sel.selectedIndex);
            glb.view.gpgpu.drawables.push(drawable)
        }
    })
}


function getSample3D(gpgpu: gpgputs.GPGPU, idx: number) : gpgputs.Drawable {
    switch(idx){
        // 円
        case 0: return (new gpgputs.Circle(new gpgputs.Color(1,0,0,1), 20)).scale(0.2, 0.1, 0.2).move(1, 0, 0.5);
        // 管
        case 1: return (new gpgputs.Tube(new gpgputs.Color(0,1,0,1), 20)).scale(0.1, 0.1, 2).move(-1, 0, 0);
        // 円柱
        case 2: return (new gpgputs.Pillar([gpgputs.Color.red, gpgputs.Color.green, gpgputs.Color.blue], 20)).scale(0.1, 0.1, 1).move(0, 3, 0);
        // 矢印
        case 3: return new gpgputs.ComponentDrawable([
            new gpgputs.UserMesh(gl.TRIANGLE_FAN, ArrowFanShader(8, 16, 9), gpgputs.GPGPU.planeFragmentShader, 8 * 16 * 3 *  9, 9),
            new gpgputs.UserMesh(gl.TRIANGLE_STRIP, ArrowTubeShader(8, 16, 9), gpgputs.GPGPU.planeFragmentShader, 8 * 16 * 2 *  9, 9)
        ]);
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
        // 測地線多面体3
        case 9: return (new gpgputs.GeodesicPolyhedron(new gpgputs.Color(0,0,1,1), 3)).scale(0.3, 0.3, 0.3).move(-1.5, -1, 0);
        // 測地線多面体4
        case 10: return (new gpgputs.GeodesicPolyhedron(new gpgputs.Color(0,0,1,1), 4)).scale(0.3, 0.3, 0.3).move(-3, -2, 0);
        // 点
        case 11: { let dr = new gpgputs.UserDef(gl.POINTS, spherePoints(32, 32) , gpgputs.GPGPU.pointFragmentShader,
            {
                pointSize: 5,
                A : new Float32Array(32 * 32 * 4),
                B : new Float32Array(32 * 32 * 4)
            });
            glb.view!.gpgpu!.makePackage(dr.package);
            dr.package.bind("B", "A");
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
        // 角錐
        case 18: return new gpgputs.UserMesh(gl.TRIANGLE_FAN, ArrowFanShader(8, 16, 9), gpgputs.GPGPU.planeFragmentShader, 8 * 16 * 3 *  9, 9);
        // 線-Tex
        case 19: { let dr = new gpgputs.UserDef(gl.POINTS, spherePointsTex(32, 32) , gpgputs.GPGPU.pointFragmentShader,
            {
                pointSize: 5,
                A : gpgpu.makeTextureInfo("vec4", [32, 32], new Float32Array(32 * 32 * 4)),
                B : new Float32Array(32 * 32 * 4)
            });
            dr.package.numInput = 32 * 32;
            glb.view!.gpgpu!.makePackage(dr.package);
            dr.package.bind("B", "A");
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
                inVel : gpgpu.makeTextureInfo("vec4", [1, sz], new Float32Array(sz * 4)),
                outPos: new Float32Array(sz * 4),
                outVel: new Float32Array(sz * 4)
            });
            dr.package.numInput = sz;
            glb.view!.gpgpu!.makePackage(dr.package);
            dr.package.bind("outPos", "inPos");
            dr.package.bind("outVel", "inVel");
            return dr;
        }
        // 面
        case 21: { 
            const sz = 512;
            let dr = new gpgputs.UserDef(gl.POINTS, surfaceWave(sz, 0.2) , gpgputs.GPGPU.pointFragmentShader,
            {
                pointSize: 1,
                inPos : gpgpu.makeTextureInfo("vec4", [sz, sz], new Float32Array(sz * sz * 4)),
                inVel : gpgpu.makeTextureInfo("vec4", [sz, sz], new Float32Array(sz * sz * 4)),
                outPos: new Float32Array(sz * sz * 4),
                outVel: new Float32Array(sz * sz * 4)
            });
            dr.package.numInput = sz * sz;
            glb.view!.gpgpu!.makePackage(dr.package);
            dr.package.bind("outPos", "inPos");
            dr.package.bind("outVel", "inVel");
            return dr;
        }
        // 電磁波
        case 22: { 
            const sx = 1024, sy = 1024, sz = 4;
            let dr1 = new gpgputs.UserDef(gl.POINTS, volumeWave(sx, sy, sz) , gpgputs.GPGPU.minFragmentShader,
            {
                pointSize: 1,
                inE : gpgpu.makeTextureInfo("vec3", [sz, sy, sx], new Float32Array(sx * sy * sz * 3)),
                inH : gpgpu.makeTextureInfo("vec3", [sz, sy, sx], new Float32Array(sx * sy * sz * 3)),
                outE: new Float32Array(sx * sy * sz * 3),
                outH: new Float32Array(sx * sy * sz * 3)
            });
            dr1.package.numInput = sx * sy * sz;
            glb.view!.gpgpu!.makePackage(dr1.package);
            dr1.package.update = ()=>{
                let idx = 0;
                let args = dr1.package.args;

                if(Math.max(sx, sy, sz) < args.tick || args.tick % 10 != 0){
                    return;
                }

                let E = args.outE as Float32Array;
                let H = args.outH as Float32Array;
                // for(let i = 0; i < sz; i++){
                //     for(let j = 0; j < sy; j++){
                //         for(let k = 0; k < sx; k++){
                //             if(E[idx] != 0 || H[idx] != 0 || E[idx+1] != 0 || H[idx+1] != 0 || E[idx+2] != 0 || H[idx+2] != 0){
                //                 console.log(`tick:${args.tick} idx:${idx} (${i} ${j} ${k}) E:(${E[idx]},${E[idx+1]},${E[idx+2]}) H:(${H[idx]},${H[idx+1]},${H[idx+2]})`);
                //             }

                //             idx += 3;
                //         }
                //     }
                // }
                let emax = E.map(x => Math.abs(x)).reduce((x,y)=>Math.max(x,y), 0);
                let hmax = H.map(x => Math.abs(x)).reduce((x,y)=>Math.max(x,y), 0);
                console.log(`tick:${args.tick} max E:${emax} H:${hmax}`);
            };

            let dr2 = new gpgputs.UserDef(gl.LINES, ArrowWave(sx, sy, sz), gpgputs.GPGPU.pointFragmentShader, 
            {
                inE : gpgpu.makeTextureInfo("vec3", [sz, sy, sx], new Float32Array(sx * sy * sz * 3)),
                inH : gpgpu.makeTextureInfo("vec3", [sz, sy, sx], new Float32Array(sx * sy * sz * 3)),
            });
            dr2.package.numInput = sx * sy * sz * 4;
            glb.view!.gpgpu!.makePackage(dr2.package);

            dr1.package.bind("outE", "inE");
            dr1.package.bind("outH", "inH");

            dr1.package.bind("outE", "inE", dr2.package);
            dr1.package.bind("outH", "inH", dr2.package);

            return new gpgputs.ComponentDrawable([dr1, dr2]);
        }
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
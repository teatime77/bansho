
namespace bansho {
export let gl : WebGL2RenderingContext;

let sample3DSel : HTMLSelectElement;

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

export const tailShader2 = `
    gl_Position = uPMVMatrix * vec4(outPos, 1.0);
    fragmentColor = outColor;

    vec3 transformedNormal = uNMatrix * outNrm;

    float directionalLightWeighting = max(dot(transformedNormal, uLightingDirection), 0.0);
    vLightWeighting = uAmbientColor + uDirectionalColor * directionalLightWeighting;
`;

//--------------------------------------------------
// 球
//--------------------------------------------------

function sphereShader(n1: number, n2: number){ 
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

//--------------------------------------------------
// 球面の点
//--------------------------------------------------

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

//--------------------------------------------------
// 球面の点 Tex
//--------------------------------------------------

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


//--------------------------------------------------
// 三角錐
//--------------------------------------------------
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

//--------------------------------------------------
// 線-LINE, 線-POINTS
//--------------------------------------------------

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


//--------------------------------------------------
// 直方体
//--------------------------------------------------

function Cuboid(gpgpu : gpgputs.GPGPU, points: number[][], depth : number){
    let gl = bansho.gl;

    let shader = `
${bansho.headShader}

uniform sampler2D inPos;

// 7 6
// 4 5

// 3 2
// 0 1

const int ids[5 * 2 * 3] = int[](
    0, 2, 1,
    2, 0, 3,

    0, 5, 1,
    5, 0, 4,

    1, 6, 2,
    6, 1, 5,

    2, 7, 3,
    7, 2, 6,

    3, 4, 0,
    4, 3, 7
);

void main(void) {
    int sx = textureSize(inPos, 0).x;

    int idx = int(gl_VertexID);

    int base = idx - idx % 3;

    vec3 pt[3];

    pt[0] = texelFetch(inPos, ivec2(ids[base  ], 0), 0).xyz;
    pt[1] = texelFetch(inPos, ivec2(ids[base+1], 0), 0).xyz;
    pt[2] = texelFetch(inPos, ivec2(ids[base+2], 0), 0).xyz;

    vec3 pp = pt[idx % 3];

    vec3 nrm = normalize( cross(pt[0] - pt[2], pt[1] - pt[2]) );

    vec3 p0 = texelFetch(inPos, ivec2(0, 0), 0).xyz;
    vec3 p6 = texelFetch(inPos, ivec2(6, 0), 0).xyz;
    vec3 center = 0.5 * (p0 + p6);

    // if(dot(nrm, pp - center) < 0.0){
    //     nrm = - nrm;
    // }

    // fragmentColor = vec4(abs(nrm.y), abs(nrm.z), abs(nrm.x), 1.0);
    fragmentColor = vec4(1.0, 0.0, 0.0, 1.0);

    gl_Position = uPMVMatrix * vec4(pp, 1.0);

    vLightWeighting = uAmbientColor + max(dot(nrm, uLightingDirection), 0.0) * uDirectionalColor;
}    `;

    //  p3 p2
    //  p0 p1

    let p0 = new gpgputs.Vec3(points[0][0], points[0][1], points[0][2]);
    let p1 = new gpgputs.Vec3(points[1][0], points[1][1], points[1][2]);
    let p3 = new gpgputs.Vec3(points[2][0], points[2][1], points[2][2]);
    let p2 = p3.add(p1.sub(p0));

    let nrm = p1.sub(p0).cross(p3.sub(p0)).unit().mul(depth);

    let pts = [ p0, p1, p2, p3, p0.add(nrm), p1.add(nrm), p2.add(nrm), p3.add(nrm) ];

    let pos = [];
    for(let pt of pts){
        pos.push(pt.x, pt.y, pt.z);
    }

    let cnt = pos.length / 3;
    let dr = new gpgputs.UserDef(gl.TRIANGLES, shader, gpgputs.GPGPU.planeFragmentShader,
    {
        inPos : gpgpu.makeTextureInfo("vec3" , [1, cnt], new Float32Array(pos)),
    });
    dr.numInput = 5 * 2 * 3;
    gpgpu.makePackage(dr);

    return dr;
}

//--------------------------------------------------
// 粒子
//--------------------------------------------------

export let SpherePkgOLD = {
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

//--------------------------------------------------
// 立方体
//--------------------------------------------------

export function CubePkg(){
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


//--------------------------------------------------
// 直線
//--------------------------------------------------

export function LinePkg(cnt: number){

    return {
        params          : "",
        numInputFormula : `2 * ${cnt}`,
        numGroup        : `2`,
        mode            : "LINES",
        fragmentShader  : gpgputs.GPGPU.pointFragmentShader,
        vertexShader    : `
    
uniform sampler2D inPos;
uniform sampler2D inVec;
uniform sampler2D inColor;
        
uniform mat4 uPMVMatrix;

out vec4 fragmentColor;

void main(void) {
    int sx  = textureSize(inPos, 0).x;

    int idx = int(gl_VertexID);

    int ip  = idx % 2;
    idx    /= 2;

    // @factorize@
    int col  = idx % sx;
    int row  = idx / sx;

    vec3 pos = texelFetch(inPos, ivec2(col, row), 0).xyz;

    if(ip == 1){
        pos += texelFetch(inVec, ivec2(col, row), 0).xyz;
    }

    fragmentColor = texelFetch(inColor, ivec2(col, row), 0);

    gl_PointSize  = 1.0;

    gl_Position = uPMVMatrix * vec4(pos, 1.0);
}

`
} as unknown as PackageInfo;
}


//--------------------------------------------------
// 矢印
//--------------------------------------------------

export let Arrow1DPkg = {
    params          : "r = 1.0, g = 0.0, b = 0.0",
    numInputFormula : "cnt * 2",
    mode            : "LINES",
    fragmentShader  : gpgputs.GPGPU.pointFragmentShader,
    vertexShader    : `

uniform sampler2D inPos;
uniform sampler2D inVec;

uniform mat4 uPMVMatrix;

out vec4 fragmentColor;

void main(void) {
    int sx  = textureSize(inPos, 0).x;

    int idx = int(gl_VertexID);

    int ip  = idx % 2;
    idx    /= 2;

    // @factorize@
    int col  = idx % sx;
    int row  = idx / sx;

    vec3 pos = vec3(texelFetch(inPos, ivec2(col, row), 0));

    if(ip == 1){

        vec3 vec = vec3(texelFetch(inVec, ivec2(col, row), 0));
        pos += vec;
    }

    fragmentColor = vec4(float(@{r}), float(@{g}), float(@{b}), 1.0);

    gl_PointSize  = 5.0;
    gl_Position = uPMVMatrix * vec4(pos, 1.0);
}`
};

//--------------------------------------------------
// 矢印3D(扇)
//--------------------------------------------------

export function ArrowFanPkg(cnt: number){
    let npt = 9;
    return {
    params          : "",
    numInputFormula : `${cnt} * 3 * ${npt}`,
    numGroup        : `${npt}`,
    mode            : "TRIANGLE_FAN",
    fragmentShader  : gpgputs.GPGPU.planeFragmentShader,
    vertexShader    : `

${bansho.headShader}

uniform int   tick;

uniform sampler2D inPos;
uniform sampler2D inVec;
uniform sampler2D inColor;

void main(void) {
    int idx = int(gl_VertexID);

    int ip  = idx % ${npt};
    idx /= ${npt};

    int mod = idx % 3;
    idx /= 3;

    vec3 pos   = vec3(texelFetch(inPos, ivec2(idx, 0), 0));
    vec3 vec   = vec3(texelFetch(inVec, ivec2(idx, 0), 0));
    vec4 color = texelFetch(inColor, ivec2(idx, 0), 0);

    // 円錐の底面の円の中心
    vec3 p1 = pos + 0.8 * vec;;

    // 円錐の頂点
    vec3 p2 = pos + vec;

    float x, y, z;
    vec3 nv;

    if(ip == 0){
        // 円錐の頂点や円の中心の場合
        
        if(mod == 0){
            // 円錐の頂点の場合

            x = p2.x;
            y = p2.y;
            z = p2.z;

            nv = normalize(p2 - p1);
        }
        else if(mod == 1){
            // 円錐の底面の円の中心の場合

            x = p1.x;
            y = p1.y;
            z = p1.z;

            nv = normalize(p1 - p2);
        }
        else{
            // 矢印の始点の円の中心の場合

            x = pos.x;
            y = pos.y;
            z = pos.z;

            nv = normalize(pos - p1);
        }
    }
    else{
        // 円錐の底面や矢印の始点の円周の場合

        vec3 e1 = normalize(vec3(p1.y - p1.z, p1.z - p1.x, p1.x - p1.y));

        vec3 e2 = normalize(cross(p1, e1));

        float theta = 2.0 * PI * float(ip - 1) / float(${npt} - 2);

        // 円の中心
        vec3 cc;

        // 円の半径
        float r;
        
        if(mod != 2){

            cc = p1;
            r = 0.05;
        }
        else{
            // 矢印の始点の円周の場合

            cc = pos;
            r = 0.02;
        }

        // 円周上の点
        vec3 p3 = cc + r * cos(theta) * e1 + r * sin(theta) * e2;

        if(mod == 0){
            // 円錐の場合

            // 円の接線方向
            vec3 e3 = sin(theta) * e1 - cos(theta) * e2;

            nv = normalize(cross(p2 - p3, e3));
        }
        else{
            // 円の場合

            nv = normalize(- vec);
        }

        x = p3.x;
        y = p3.y;
        z = p3.z;
    }

    float nx = nv.x, ny = nv.y, nz = nv.z;

    fragmentColor = color;

    ${bansho.tailShader}
}`

    } as unknown as PackageInfo;
}

//--------------------------------------------------
// 管
//--------------------------------------------------

export function TubePkg(sim: Simulation, info: PackageInfo, cnt: number, length: number | undefined = undefined ){
    let npt = 9;
    if(length == undefined){
        length = 1;
    }

    let map = getParamsMap([ sim.params, info.params ]);
    if(map == null){
        throw new Error();
    }

    let radius = 0.02;
    if(map.radius != undefined){
        radius = map.radius;
    }

    return {
    params          : "",
    numInputFormula : `${cnt} * 2 * ${npt}`,
    numGroup        : `2 * ${npt}`,
    mode            : "TRIANGLE_STRIP",
    fragmentShader  : gpgputs.GPGPU.planeFragmentShader,
    vertexShader    : `

    ${bansho.headShader}
    
    uniform int   tick;
    
    uniform sampler2D inPos;
    uniform sampler2D inVec;
    uniform sampler2D inColor;
    
    void main(void) {
        int idx = int(gl_VertexID);
    
        int lh  = idx % 2;
        idx /= 2;
    
        int ip  = idx % ${npt};
        idx /= ${npt};
    
        vec3 pos   = vec3(texelFetch(inPos, ivec2(idx, 0), 0));
        vec3 vec   = vec3(texelFetch(inVec, ivec2(idx, 0), 0));
        vec4 color = texelFetch(inColor, ivec2(idx, 0), 0);
    
        vec3 e1 = normalize(vec3(vec.y - vec.z, vec.z - vec.x, vec.x - vec.y));
    
        vec3 e2 = normalize(cross(vec, e1));
    
        // 円の中心
        vec3 cc;
    
        if(lh == 0){
            cc = pos;
        }
        else{
    
            cc = pos + float(${length}) * vec;
        }
    
        // 円の半径
        float r = float(${radius});
    
        float theta = 2.0 * PI * float(ip - 1) / float(${npt} - 2);
    
        // 円周上の点
        vec3 p3 = cc + r * cos(theta) * e1 + r * sin(theta) * e2;
        
        // 法線ベクトル
        vec3 nv = normalize(p3 - cc);
    
        float x = p3.x;
        float y = p3.y;
        float z = p3.z;
    
        float nx = nv.x, ny = nv.y, nz = nv.z;
    
        fragmentColor = color;
    
        ${bansho.tailShader}
    }`

    } as unknown as PackageInfo;
}

//--------------------------------------------------
// 球
//--------------------------------------------------

export function SpherePkg(sim: Simulation, info: PackageInfo, cnt: number){
    let map = getParamsMap([ sim.params, info.params ]);
    if(map == null){
        throw new Error();
    }

    let numDiv = map.numDiv;
    if(numDiv == undefined || isNaN(numDiv)){
        throw new Error();
    }

    return {
    params          : "",
    numInputFormula : `${cnt} * 2 * 2 * ${numDiv + 1} * ${numDiv}`,
    numGroup        : `2 * 2 * ${numDiv + 1}`,
    mode            : "TRIANGLE_STRIP",
    fragmentShader  : gpgputs.GPGPU.planeFragmentShader,
    vertexShader    : `

    ${bansho.headShader}
    
uniform sampler2D inPos;
uniform sampler2D inR;
uniform sampler2D inColor;

void main(void) {
    int idx = int(gl_VertexID);

    // STRIPの上下
    int lh  = idx % 2;
    idx    /= 2;

    // 経線方向の番号
    int col = idx % ${2 * (numDiv + 1)};
    idx    /= ${2 * (numDiv + 1)};

    // 緯線方向の番号
    int row  = idx % ${numDiv};
    idx /= ${numDiv};

    // 中心
    vec3  pos     = texelFetch(inPos  , ivec2(idx, 0), 0).xyz;

    // 半径
    float r       = texelFetch(inR    , ivec2(idx, 0), 0).x;

    // 色
    vec4 outColor = texelFetch(inColor, ivec2(idx, 0), 0);

    // 緯度
    float u;
    if(lh == 0){
        u = PI * float(row  ) / float(${numDiv});
    }
    else{
        u = PI * float(row+1) / float(${numDiv});
    }

    // 経度
    float v = 2.0 * PI * float(col) / float(2 * ${numDiv});

    // 三角形の頂点の座標
    vec3 outPos = pos + r * vec3(sin(u) * cos(v), sin(u) * sin(v), cos(u));
    
    // 法線ベクトル
    vec3 outNrm = normalize(outPos - pos);

    ${bansho.tailShader2}
}`

    } as unknown as PackageInfo;
}


//--------------------------------------------------
// 円
//--------------------------------------------------

export function CirclePkgNEW(sim: Simulation, info: PackageInfo, cnt: number){
    let map = getParamsMap([ sim.params, info.params ]);
    if(map == null){
        throw new Error();
    }

    let numDiv1 = map.numDiv1;
    if(numDiv1 == undefined || isNaN(numDiv1)){
        throw new Error();
    }

    let numDiv2 = map.numDiv2;
    if(numDiv2 == undefined || isNaN(numDiv2)){
        throw new Error();
    }

    let radius = map.radius;
    if(radius == undefined || isNaN(radius)){
        radius = 3.0;
    }

    return {
    params          : "",
    numInputFormula : `${cnt} * 2 * ${numDiv1} * ${numDiv2 + 1}`,
    mode            : "TRIANGLE_STRIP",
    fragmentShader  : gpgputs.GPGPU.planeFragmentShader,
    vertexShader    : `

${bansho.headShader}

uniform sampler2D inPos;
uniform sampler2D inR;
uniform sampler2D inNrm;
uniform sampler2D inColor;

void main(void) {
    int sx  = textureSize(inPos, 0).x;

    int idx = int(gl_VertexID);

    // STRIPの上下
    int lh  = idx % 2;
    idx    /= 2;

    // 経線方向の番号
    int col = idx % ${numDiv1};
    idx    /= ${numDiv1};

    // 経線方向の番号
    int row = idx % ${numDiv2 + 1};
    idx    /= ${numDiv2 + 1};

    // @factorize@
    int col1  = idx % sx;
    int row1  = idx / sx;

    // 中心
    vec3  pos = texelFetch(inPos  , ivec2(col1, row1), 0).xyz;

    // 半径
    float r   = texelFetch(inR    , ivec2(col1, row1), 0).x;

    // 法線
    vec3 nrm  = normalize(texelFetch(inNrm  , ivec2(col1, row1), 0).xyz);

    // 色
    vec4 outColor = texelFetch(inColor, ivec2(col1, row1), 0);

    vec3 e1 = normalize(vec3(nrm.y - nrm.z, nrm.z - nrm.x, nrm.x - nrm.y));
    vec3 e2 = cross(nrm, e1);

    float i1 = float(row) + float(col + lh * ${numDiv1}) / float(${numDiv1});
    float i2 = i1 + 1.0 / float(${numDiv1});
    
    float u1 = 2.0 * PI * i1 / float(${numDiv2});
    float u2 = 2.0 * PI * i2 / float(${numDiv2});

    // 円の中心から管の中心へのベクトル
    vec3 op = r * (cos(u1) * e1 + sin(u1) * e2);

    // 管の中心の座標
    vec3 pc = pos + op;

    // 進行方向のベクトル
    vec3 dc = pos + r * (cos(u2) * e1 + sin(u2) * e2) - pc;

    // 遠心方向の単位ベクトル
    vec3 f1 = normalize(op);

    // 進行方向と遠心方向に垂直な単位ベクトル
    vec3 f2 = normalize(cross(dc, f1));

    float t = 2.0 * PI * float(col) / float(${numDiv1});
    vec3 outPos = pc + float(${radius}) * (cos(t) * f1 + sin(t) * f2);

    outColor    = vec4(u1 / 2.0 * PI, t / 2.0 * PI, 0.0, 1.0);
    outColor    = vec4(t / 2.0 * PI, t / 2.0 * PI, 0.0, 1.0);
    // outColor = vec4(abs(sin(t)), abs(sin(t)), 0.0, 1.0);

    vec3 outNrm = outPos - pc;

    ${bansho.tailShader2}
}`

    } as unknown as PackageInfo;
}
export function CirclePkg(sim: Simulation, info: PackageInfo, cnt: number){
    let map = getParamsMap([ sim.params, info.params ]);
    if(map == null){
        throw new Error();
    }

    let numPnt = map.numPnt;
    if(numPnt == undefined || isNaN(numPnt)){
        throw new Error();
    }

    let sizePnt = map.sizePnt;
    if(sizePnt == undefined || isNaN(sizePnt)){
        sizePnt = 3.0;
    }

    return {
    params          : "",
    numInputFormula : `${cnt} * ${numPnt}`,
    mode            : "POINTS",
    fragmentShader  : gpgputs.GPGPU.pointFragmentShader,
    vertexShader    : `

uniform mat4 uPMVMatrix;

out vec4 fragmentColor;

#define PI 3.14159265359

uniform sampler2D inPos;
uniform sampler2D inR;
uniform sampler2D inNrm;
uniform sampler2D inColor;

void main(void) {
    int idx = int(gl_VertexID);

    // 経線方向の番号
    int col = idx % ${numPnt};
    idx    /= ${numPnt};

    // 中心
    vec3  pos = texelFetch(inPos  , ivec2(idx, 0), 0).xyz;

    // 半径
    float r   = texelFetch(inR    , ivec2(idx, 0), 0).x;

    // 法線
    vec3 nrm  = normalize(texelFetch(inNrm  , ivec2(idx, 0), 0).xyz);

    // 色
    fragmentColor = texelFetch(inColor, ivec2(idx, 0), 0);

    vec3 e1 = normalize(vec3(nrm.y - nrm.z, nrm.z - nrm.x, nrm.x - nrm.y));
    vec3 e2 = cross(nrm, e1);

    // 経度
    float v = 2.0 * PI * float(col) / float(${numPnt});

    // 三角形の頂点の座標
    vec3 outPos = pos + r * (cos(v) * e1 + sin(v) * e2);

    vec3 outNrm = nrm;

    gl_Position   = uPMVMatrix * vec4(outPos, 1.0);
    gl_PointSize  = float(${sizePnt});
}`

    } as unknown as PackageInfo;
}


//--------------------------------------------------
// 円板
//--------------------------------------------------

export function DiskPkg(sim: Simulation, info: PackageInfo, cnt: number){
    let map = getParamsMap([ sim.params, info.params ]);
    if(map == null){
        throw new Error();
    }

    let numDiv = map.numDiv;
    if(numDiv == undefined || isNaN(numDiv)){
        throw new Error();
    }

    return {
    params          : "",
    numInputFormula : `${cnt} * ${1 + numDiv + 1}`,
    numGroup        : `${1 + numDiv + 1}`,
    mode            : "TRIANGLE_FAN",
    fragmentShader  : gpgputs.GPGPU.planeFragmentShader,
    vertexShader    : `

    ${bansho.headShader}
    
uniform sampler2D inPos;
uniform sampler2D inR;
uniform sampler2D inNrm;
uniform sampler2D inColor;

void main(void) {
    int idx = int(gl_VertexID);

    // 経線方向の番号
    int col = idx % ${1 + numDiv + 1};
    idx    /= ${1 + numDiv + 1};

    // 中心
    vec3  pos     = texelFetch(inPos  , ivec2(idx, 0), 0).xyz;

    // 半径
    float r       = texelFetch(inR    , ivec2(idx, 0), 0).x;

    // 法線
    vec3 outNrm   = normalize(texelFetch(inNrm  , ivec2(idx, 0), 0).xyz);

    // 色
    vec4 outColor = texelFetch(inColor, ivec2(idx, 0), 0);

    // 三角形の頂点の座標
    vec3 outPos;

    if(col == 0){
        outPos = pos;
    }
    else{

        // 経度
        float v = 2.0 * PI * float(col - 1) / float(${numDiv});

        outPos = pos + r * vec3(cos(v), sin(v), 0.0);
    }

    ${bansho.tailShader2}
}`

    } as unknown as PackageInfo;
}

//--------------------------------------------------
// 三角形
//--------------------------------------------------

export function TrianglePkg(cnt: number){
    return {
    params          : "",
    numInputFormula : `${cnt} * 3`,
    mode            : "TRIANGLES",
    fragmentShader  : gpgputs.GPGPU.planeFragmentShader,
    vertexShader    : `

${bansho.headShader}

uniform int   tick;

uniform sampler2D inPos1;
uniform sampler2D inPos2;
uniform sampler2D inPos3;
uniform sampler2D inColor;

void main(void) {
    int sx  = textureSize(inPos1, 0).x;

    int idx = int(gl_VertexID);

    int ip = idx % 3;
    idx    /= 3;

    // @factorize@
    int col  = idx % sx;
    int row  = idx / sx;

    vec3 pos1  = vec3(texelFetch(inPos1 , ivec2(col, row), 0));
    vec3 pos2  = vec3(texelFetch(inPos2 , ivec2(col, row), 0));
    vec3 pos3  = vec3(texelFetch(inPos3 , ivec2(col, row), 0));
    vec4 color =      texelFetch(inColor, ivec2(col, row), 0) ;

    switch(ip){
    case 0:
        gl_Position = uPMVMatrix * vec4(pos1, 1.0);
        break;
    case 1:
        gl_Position = uPMVMatrix * vec4(pos2, 1.0);
        break;
    case 2:
        gl_Position = uPMVMatrix * vec4(pos3, 1.0);
        break;
    }

    vec3 nrm = normalize(cross(pos3 - pos1, pos2 - pos1));

    fragmentColor = color;

    vec3 transformedNormal = uNMatrix * nrm;

    float directionalLightWeighting = max(dot(transformedNormal, uLightingDirection), 0.0);
    vLightWeighting = uAmbientColor + uDirectionalColor * directionalLightWeighting;
}`

    } as unknown as PackageInfo;
}


//--------------------------------------------------
// 平行四辺形
//--------------------------------------------------

export function ParallelogramPkg(cnt: number){
    return {
    params          : "",
    numInputFormula : `${cnt} * 6`,
    mode            : "TRIANGLES",
    fragmentShader  : gpgputs.GPGPU.planeFragmentShader,
    vertexShader    : `

${bansho.headShader}

uniform int   tick;

uniform sampler2D inPos;
uniform sampler2D inVec1;
uniform sampler2D inVec2;
uniform sampler2D inColor;

void main(void) {
    int idx = int(gl_VertexID);

    int ip = idx % 6;
    idx    /= 6;

    // @factorize@
    int sx   = textureSize(inPos, 0).x;
    int col  = idx % sx;
    int row  = idx / sx;

    vec3 pos   = vec3(texelFetch(inPos  , ivec2(col, row), 0));
    vec3 v1    = vec3(texelFetch(inVec1 , ivec2(col, row), 0));
    vec3 v2    = vec3(texelFetch(inVec2 , ivec2(col, row), 0));
    vec4 color =      texelFetch(inColor, ivec2(col, row), 0) ;

    switch(ip){
    case 0:
        gl_Position = uPMVMatrix * vec4(pos, 1.0);
        break;
    case 1:
    case 4:
        gl_Position = uPMVMatrix * vec4(pos + v2, 1.0);
        break;
    case 2:
    case 3:
        gl_Position = uPMVMatrix * vec4(pos + v1, 1.0);
        break;
    case 5:
        gl_Position = uPMVMatrix * vec4(pos + v2 + v1, 1.0);
        break;
    }

    vec3 nrm = normalize(cross(v1, v2));

    fragmentColor = color;

    vec3 transformedNormal = uNMatrix * nrm;

    float directionalLightWeighting = max(dot(transformedNormal, uLightingDirection), 0.0);
    vLightWeighting = uAmbientColor + uDirectionalColor * directionalLightWeighting;
}`

    } as unknown as PackageInfo;
}




//--------------------------------------------------
// 直方体
//--------------------------------------------------

export function CuboidPkg(cnt: number){
    return {
    params          : "",
    numInputFormula : `${cnt} * 6 * 6`,
    mode            : "TRIANGLES",
    fragmentShader  : gpgputs.GPGPU.planeFragmentShader,
    vertexShader    : `

${bansho.headShader}

uniform int   tick;

uniform sampler2D inPos;
uniform sampler2D inSize;
uniform sampler2D inColor;

void main(void){
    int sx  = textureSize(inPos, 0).x;

    int idx = int(gl_VertexID);

    // 三角形の3点
    int i1 = idx % 3;
    idx /= 3;

    // 面内の2つ三角形
    int i2 = idx % 2;
    idx /= 2;

    // p1の有無
    int i3 = idx % 2;
    idx /= 2;

    // x, y, zの役割
    int i4 = idx % 3;
    idx /= 3;

    // @factorize@
    int col  = idx % sx;
    int row  = idx / sx;

    vec3 pos      = texelFetch(inPos  , ivec2(col, row), 0).xyz;
    vec3 size     = texelFetch(inSize , ivec2(col, row), 0).xyz;
    vec4 outColor = texelFetch(inColor, ivec2(col, row), 0) ;

    vec3 v[3];
    v[ i4     ] = vec3(size.x, 0.0   , 0.0 );
    v[(i4+1)%3] = vec3(0.0   , size.y, 0.0 );
    v[(i4+2)%3] = vec3(0.0   , 0.0   , size.z );

    vec3 pos2 = pos;
    if(i3 == 1){
        pos2 += v[0];
    }
    
    vec3 q1 = pos2;
    if(i2 == 1){
        q1 += v[1] + v[2];
    }
    vec3 q2 = pos2 + v[1];
    vec3 q3 = pos2 + v[2];

    // 直方体の中心
    vec3 c1 = pos + 0.5 * size;

    // 三角形の重心
    vec3 c2 = 0.3 * (q1 + q2 + q3);

    // 法線ベクトル
    vec3 outNrm = normalize(cross(q3 - q1, q2 - q1));

    if(dot(c2 - c1, outNrm) < 0.0){
        // 法線ベクトルが外を向いていない場合

        outNrm = - outNrm;
    }

    // 三角形の頂点の座標
    vec3 outPos;
    switch(i1){
    case 0: outPos = q1; break;
    case 1: outPos = q2; break;
    case 2: outPos = q3; break;
    }

    ${bansho.tailShader2}

}`

    } as unknown as PackageInfo;
}





//--------------------------------------------------
// 曲面
//--------------------------------------------------

export function SurfacePkg(){
    return {
        params          : "",
        numInputFormula : "cnt * 2",
        mode            : "TRIANGLE_STRIP",
        fragmentShader  : gpgputs.GPGPU.planeFragmentShader,
        vertexShader    : `

        ${headShader}
        
        uniform int   tick;
        
        uniform sampler2D inPos;
        
        ${PseudoColor}
        
        void main(void) {
            int sx  = textureSize(inPos, 0).x;
            int sy  = textureSize(inPos, 0).y;

            int idx = int(gl_VertexID);
        
            int ip  = idx % 2;
            idx    /= 2;
        
            int col  = idx % sx;
            int row  = idx / sx;
            if(ip == 1 && row + 1 < sy){
                row++;
            }
        
            vec3 pos = vec3(texelFetch(inPos, ivec2(col, row), 0));
        
            vec3 x1 = pos, x2 = pos;
            vec3 y1 = pos, y2 = pos;
        
            if(0 <= col - 1){
                x1 = texelFetch(inPos, ivec2(col - 1, row), 0).xyz;
            }
            if(col + 1 < sx){
                x2 = texelFetch(inPos, ivec2(col + 1, row), 0).xyz;
            }
            if(0 <= row - 1){
                y1 = texelFetch(inPos, ivec2(col, row - 1), 0).xyz;
            }
            if(row + 1 < sy){
                y2 = texelFetch(inPos, ivec2(col, row + 1), 0).xyz;
            }
        
            vec3 nrm = normalize(cross(x2 - x1, y2 - y1));
        
            fragmentColor = vec4(PseudoColor(-0.01, 0.01, pos.z), 1.0);
        
            gl_Position = uPMVMatrix * vec4(pos, 1.0);
        
            float directionalLightWeighting = max(dot(nrm, uLightingDirection), 0.0);
            vLightWeighting = uAmbientColor + uDirectionalColor * directionalLightWeighting;
        }`
    }
}


//--------------------------------------------------
// 疑似カラー
//--------------------------------------------------

const PseudoColor = `
vec3 PseudoColor(float min_val, float max_val, float val){
    float f = (max(min_val, min(max_val, val)) - min_val) / (max_val - min_val);

    vec3 col;
    if(f < 0.25){
        col.r = 0.0;
        col.g = f / 0.25;
        col.b = 1.0;
    }
    else if(f < 0.5){
        col.r = 0.0;
        col.g = 1.0;
        col.b = (0.5 - f) / 0.25;
    }
    else if(f < 0.75){
        col.r = (f - 0.5) / 0.25;
        col.g = 1.0;
        col.b = 0.0;
    }
    else {
        col.r = 1.0;
        col.g = (1.0 - f) / 0.25;
        col.b = 0.0;
    }

    return col;
}
`;

//--------------------------------------------------
// ユーザー定義
//--------------------------------------------------

export let userShader = `
uniform int   tick;

uniform sampler2D inPos;
out vec3 outPos;

int rnd_cnt = 0;
float rnd(){
    return 2.0 * fract( sin(float(gl_VertexID) * 12.9898 + float(rnd_cnt++) * 78.233) * 43758.5453) - 1.0;
}

void main(void) {
    int idx = int(gl_VertexID);
    
    if(tick == 0){

    }
    else{

    }
}`;


function initSample3D(gpgpu: gpgputs.GPGPU){
    sample3DSel = document.getElementById("sample-3d") as HTMLSelectElement;
    const names = [
        "円",
        "円柱",
        "点1",
        "線",
        "正二十面体",
        "球面の点",
        "線-LINE",
        "線-POINTS",
        "球",
        "三角錐",
        "球面の点 Tex",
        "測地線多面体",
        "管",
        "直方体",
    ];

    for(let name of names){
        let opt = document.createElement("option");
        opt.value = name;
        opt.innerText = name;
        sample3DSel.appendChild(opt);
    }    

    sample3DSel.addEventListener("input", (ev: Event)=>{
        gpgpu.clearAll();

        let drawable = getSample3D(gpgpu);
        if(drawable != null){

            gpgpu.drawables.push(drawable)
        }
    })
}


function getSample3D(gpgpu: gpgputs.GPGPU) : gpgputs.AbsDrawable | null {
    gpgpu.drawParam = new gpgputs.DrawParam(0, 0, 0, 0, 0, -5.0);

    switch(sample3DSel.value){
        case "円": return (new gpgputs.Circle(new gpgputs.Color(1,0,0,1), 20)).scale(0.2, 0.1, 0.2).move(1, 0, 0.5);
        case "円柱": return (new gpgputs.Pillar([gpgputs.Color.red, gpgputs.Color.green, gpgputs.Color.blue], 20)).scale(0.1, 0.1, 1).move(0, 3, 0);
        case "点1": return new gpgputs.Points(new Float32Array([1.5, -1.3, 0, -1.5, -1.3, 0]), new Float32Array([1,0,0,1, 0,0,1,1]), 5);
        case "線": return new gpgputs.Lines([{x:1.5,y:-1.5,z:0} as gpgputs.Vertex,{x:-1.5,y:-1.5,z:0} as gpgputs.Vertex], gpgputs.Color.blue);
        case "正二十面体": return (new gpgputs.RegularIcosahedron(new gpgputs.Color(0,1,0,1))).scale(0.3, 0.3, 0.3).move(2, -2, 0);
        case "球面の点": { let dr = new gpgputs.UserDef(gl.POINTS, spherePoints(32, 32) , gpgputs.GPGPU.pointFragmentShader,
            {
                pointSize: 5,
                A : new Float32Array(32 * 32 * 4),
                B : new Float32Array(32 * 32 * 4)
            });
            gpgpu.makePackage(dr);
            dr.bind("B", "A");
            return dr;
        }
        case "線-LINE": return new gpgputs.UserMesh(gl.LINE_STRIP, LineShader(32), gpgputs.GPGPU.pointFragmentShader, 32);
        case "線-POINTS": return new gpgputs.UserMesh(gl.POINTS, LineShader(512), gpgputs.GPGPU.pointFragmentShader, 512);
        case "球": return new gpgputs.UserMesh(gl.TRIANGLES, sphereShader(64, 64), gpgputs.GPGPU.planeFragmentShader, 64 * 64 * 6);
        case "三角錐": return new gpgputs.UserMesh(gl.TRIANGLES, Tetrahedron()       , gpgputs.GPGPU.planeFragmentShader, 4 * 3).move(0, 1, 0);
        case "球面の点 Tex": { let dr = new gpgputs.UserDef(gl.POINTS, spherePointsTex(32, 32) , gpgputs.GPGPU.pointFragmentShader,
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
        case "測地線多面体": return (new gpgputs.GeodesicPolyhedron(new gpgputs.Color(0,0,1,1), 2)).scale(0.3, 0.3, 0.3).move(1.5,  1, 0);
        case "管": return (new gpgputs.Tube(new gpgputs.Color(0,1,0,1), 20)).scale(0.1, 0.1, 2).move(-1, 0, 0);
        case "直方体": return Cuboid(gpgpu, [ [-1.0, -1.0, 0], [1.0, -1.0, 0], [-1.0, 1.0, 0] ], 1.0);
    }
    throw new Error();
}


export function testGpgpu(){
    var canvas = document.getElementById("webgl-canvas") as HTMLCanvasElement;
    let gpgpu = make3D(canvas);

    initSample3D(gpgpu);
}

}
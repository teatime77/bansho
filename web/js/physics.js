
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
// 立方体
//--------------------------------------------------
function CubeShader(){ 
    return `
${bansho.headShader}

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

    ${bansho.tailShader}
}`;
}

//--------------------------------------------------
// 線の矢印
//--------------------------------------------------

function ArrowLineShader(sx, r, g, b){ 
    return `

precision highp sampler3D;

uniform mat4 uPMVMatrix;
uniform mat3 uNMatrix;

uniform sampler2D inPos;
uniform sampler2D inVec;

out vec4 fragmentColor;

void main(void) {
    int idx = int(gl_VertexID);

    int ip  = idx % 2;
    idx    /= 2;

    int col  = idx % ${sx};
    int row  = idx / ${sx};

    vec4 pos = texelFetch(inPos, ivec2(col, row), 0);

    if(ip == 1){
        vec4 vec = texelFetch(inVec, ivec2(col, row), 0);
        pos += vec;
    }

    fragmentColor = vec4(float(${r}), float(${g}), float(${b}), 1.0);

    gl_Position = uPMVMatrix * vec4(vec3(pos), 1.0);
}`;
}

function Factorization(cnt){
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

function ArrowLine(gpgpu, dr1, pos_name, vec_name, cnt, r, g, b){
    let [ sy, sx ] = Factorization(cnt);
    console.log(`因数分解 ${cnt} = ${sy} x ${sx}`);

    let dr2 = new gpgputs.UserDef(bansho.gl.LINES, ArrowLineShader(sx, r, g, b), gpgputs.GPGPU.pointFragmentShader, 
    {
        inPos : gpgpu.makeTextureInfo("vec3", [sy, sx]),
        inVec : gpgpu.makeTextureInfo("vec3", [sy, sx]),
    });
    dr2.numInput = cnt * 2;
    gpgpu.makePackage(dr2);

    dr1.bind(pos_name, "inPos", dr2);
    dr1.bind(vec_name, "inVec", dr2);

    return dr2;
}


//--------------------------------------------------
// 3D矢印
//--------------------------------------------------

function Arrow3D(gpgpu, dr1, pos_name, vec_name, cnt, r, g, b){
    let [ sy, sx ] = Factorization(cnt);
    console.log(`3D矢印 因数分解 ${cnt} = ${sy} x ${sx}`);

    const npt = 9;
    let dr2 = new gpgputs.UserDef(bansho.gl.TRIANGLE_FAN, ArrowFanShader(npt, sx, r, g, b), gpgputs.GPGPU.planeFragmentShader, {
        inPos : gpgpu.makeTextureInfo("vec3", [sy, sx]),
        inVec : gpgpu.makeTextureInfo("vec3", [sy, sx])
    });
    dr2.numInput = cnt * 3 * 9;
    dr2.numGroup = 9;

    let dr3 = new gpgputs.UserDef(bansho.gl.TRIANGLE_STRIP, ArrowTubeShader(npt, sx, r, g, b), gpgputs.GPGPU.planeFragmentShader, {
        inPos : gpgpu.makeTextureInfo("vec3", [sy, sx]),
        inVec : gpgpu.makeTextureInfo("vec3", [sy, sx])
    });
    dr3.numInput = cnt * 2 * npt;
    dr3.numGroup = 2 * npt;

    gpgpu.makePackage(dr2);
    gpgpu.makePackage(dr3);

    dr1.bind(pos_name, "inPos", dr2);
    dr1.bind(vec_name, "inVec", dr2);

    dr1.bind(pos_name, "inPos", dr3);
    dr1.bind(vec_name, "inVec", dr3);

    return new gpgputs.ComponentDrawable([dr1, dr2, dr3]);
}


//--------------------------------------------------
// 矢印の円錐と円
//--------------------------------------------------

function ArrowFanShader(npt, sx, r, g, b){ 
    return `

${bansho.headShader}

uniform int   tick;

uniform sampler2D inPos;
uniform sampler2D inVec;

void main(void) {
    int idx = int(gl_VertexID);

    int ip  = idx % ${npt};
    idx /= ${npt};

    int mod = idx % 3;
    idx /= 3;

    int col  = idx % ${sx};
    int row  = idx / ${sx};

    vec3 pos = vec3(texelFetch(inPos, ivec2(col, row), 0));
    vec3 vec = vec3(texelFetch(inVec, ivec2(col, row), 0));

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

        float theta = 2.0 * PI * float(ip - 1) / float(${npt - 2});

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

    // fragmentColor = vec4(abs(ny), abs(nz), abs(nx), 1.0);
    fragmentColor = vec4(${r}, ${g}, ${b}, 1.0);

    ${bansho.tailShader}
}`;
}


//--------------------------------------------------
// 矢印の円柱部分
//--------------------------------------------------

function ArrowTubeShader(npt, sx, r, g, b){ 
    return `

${bansho.headShader}

uniform int   tick;

uniform sampler2D inPos;
uniform sampler2D inVec;

void main(void) {
    int idx = int(gl_VertexID);

    int lh  = idx % 2;
    idx /= 2;

    int ip  = idx % ${npt};
    idx /= ${npt};

    int col  = idx % ${sx};
    int row  = idx / ${sx};

    vec3 pos = vec3(texelFetch(inPos, ivec2(col, row), 0));
    vec3 vec = vec3(texelFetch(inVec, ivec2(col, row), 0));

    vec3 e1 = normalize(vec3(vec.y - vec.z, vec.z - vec.x, vec.x - vec.y));

    vec3 e2 = normalize(cross(vec, e1));

    // 円の中心
    vec3 cc;

    if(lh == 0){
        cc = pos;
    }
    else{

        cc = pos + 0.8 * vec;
    }

    // 円の半径
    float r = 0.02;

    float theta = 2.0 * PI * float(ip - 1) / float(${npt - 2});

    // 円周上の点
    vec3 p3 = cc + r * cos(theta) * e1 + r * sin(theta) * e2;
    
    // 法線ベクトル
    vec3 nv = normalize(p3 - cc);

    float x = p3.x;
    float y = p3.y;
    float z = p3.z;

    float nx = nv.x, ny = nv.y, nz = nv.z;

    // fragmentColor = vec4(abs(ny), abs(nz), abs(nx), 1.0);
    fragmentColor = vec4(${r}, ${g}, ${b}, 1.0);

    ${bansho.tailShader}
}`;
}

//--------------------------------------------------
// 粒子
//--------------------------------------------------

function particlePackage(gpgpu, cnt, n1, n2, radius){
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

    let pkg = new gpgputs.UserDef(bansho.gl.TRIANGLES, shader, gpgputs.GPGPU.planeFragmentShader, {
        inPos : gpgpu.makeTextureInfo("vec3" , [sy, sx])
    });
    pkg.numInput = cnt * n1 * n2 * 6;
    gpgpu.makePackage(pkg);

    return pkg;
}


//--------------------------------------------------
// 3D矢印のテスト
//--------------------------------------------------

function ArrowTest(gpgpu){
    let nrow = 16, ncol = 16;

    let dr1 = new gpgputs.UserDef(bansho.gl.POINTS, ArrowTestData(nrow, ncol) , gpgputs.GPGPU.minFragmentShader,
    {
        pos: new Float32Array(nrow * ncol * 3),
        vec: new Float32Array(nrow * ncol * 3)
    });
    dr1.numInput = nrow * ncol;
    gpgpu.makePackage(dr1);

    return Arrow3D(gpgpu, dr1, "pos", "vec", dr1.numInput, 0.5, 0.5, 0.5);
}


function ArrowTestData(nrow, ncol){
    return `

#define PI 3.14159265359

uniform int   tick;

out vec3 pos;
out vec3 vec;

void main(void) {
    int idx = int(gl_VertexID);

    int col  = idx % ${ncol};
    int row  = idx / ${ncol};

    float u =       PI * float(row) / float(${nrow});
    float v = 2.0 * PI * float(col) / float(${ncol});

    float x = sin(u) * cos(v);
    float y = sin(u) * sin(v);
    float z = cos(u);

    pos = vec3(x, y, z);
        
    vec = 0.3 * normalize(pos);
}
    `;
}

//--------------------------------------------------
// 電磁波
//--------------------------------------------------

function testEMWave(gpgpu){ 
    // const sx = 1024, sy = 1024, sz = 4;
    // const sx = 64, sy = 64, sz = 4;
    // const sx = 1024, sy = 1024, sz = 1;
    const sx = 256, sy = 256, sz = 1;
    let dr1 = new gpgputs.UserDef(bansho.gl.POINTS, volumeWave(sx, sy, sz) , gpgputs.GPGPU.minFragmentShader,
    {
        pointSize: 1,
        inE : gpgpu.makeTextureInfo("vec3", [sz, sy, sx]),
        inH : gpgpu.makeTextureInfo("vec3", [sz, sy, sx]),
    });
    dr1.numInput = sx * sy * sz;
    gpgpu.makePackage(dr1);
    // dr1.fps = 1;
    dr1.update = ()=>{
        let idx = 0;
        let args = dr1.args;

        if(Math.max(sx, sy, sz) < args.tick || args.tick % 10 != 0){
            return;
        }

        let E = args.outE;
        let H = args.outH;
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

    let dr2 = ArrowLine(gpgpu, dr1, "outPos", "outE", dr1.numInput, 0.0, 0.0, 1.0);
    let dr3 = ArrowLine(gpgpu, dr1, "outPos", "outH", dr1.numInput, 1.0, 0.0, 0.0);

    dr1.bind("outE", "inE");
    dr1.bind("outH", "inH");

    return new gpgputs.ComponentDrawable([dr1, dr2, dr3]);
}


//--------------------------------------------------
// 波
//--------------------------------------------------

const K = 1.0 / 16.0;

function volumeWave(sx, sy, sz){ 
    return `

precision highp sampler3D;

uniform int   tick;
    
uniform sampler3D inE;
uniform sampler3D inH;
out vec3 outPos;
out vec3 outE;
out vec3 outH;

#define PI 3.14159265359

#define mu0      1.25663706212e-06
#define epsilon0 8.854187812799999e-12
#define c0       299792458

${PseudoColor}

vec3 calcRot(int flag, vec3 E, vec3 H, int i, int j, int k){
    if(flag == 1){
        vec3 Ei = E;
        vec3 Ej = E;
        vec3 Ek = E;

        if(i + 1 < ${sx}){

            Ei = vec3(texelFetch(inE, ivec3(i + 1, j    , k    ), 0));
        }

        if(j + 1 < ${sy}){

            Ej = vec3(texelFetch(inE, ivec3(i    , j + 1, k    ), 0));
        }

        if(k + 1 < ${sz}){

            Ek = vec3(texelFetch(inE, ivec3(i    , j    , k + 1), 0));
        }

        float rx = (Ej.z - E.z) - (Ek.y - E.y);
        float ry = (Ek.x - E.x) - (Ei.z - E.z);
        float rz = (Ei.y - E.y) - (Ej.x - E.x);

        return vec3(rx, ry, rz);
    }
    else{

        vec3 Hi = H; 
        vec3 Hj = H; 
        vec3 Hk = H; 

        if(0 <= i - 1){

            Hi = vec3(texelFetch(inH, ivec3(i - 1, j    , k    ), 0));
        }

        if(0 <= j - 1){

            Hj = vec3(texelFetch(inH, ivec3(i    , j - 1, k    ), 0));
        }

        if(0 <= k - 1){

            Hk = vec3(texelFetch(inH, ivec3(i    , j    , k - 1), 0));
        }

        float rx = (H.z - Hj.z) - (H.y - Hk.y);
        float ry = (H.x - Hk.x) - (H.z - Hi.z);
        float rz = (H.y - Hi.y) - (H.x - Hj.x);

        return vec3(rx, ry, rz);
    }
}

void main(void) {
    float L = 3.2 / float(${Math.max(sx, sy, sz)});
    float K = float(${K});

    int idx = int(gl_VertexID);

    int col  = idx % ${sx};
    idx     /= ${sx};

    int row  = idx % ${sy};
    int dep  = idx / ${sy};

    float x = float(col - ${Math.round(sx/2)}) * L;
    float y = float(row - ${Math.round(sy/2)}) * L;
    float z = float(dep - ${Math.round(sz/2)}) * L;

    vec3 E, H;

    if(tick == 0){
        E = vec3(0.0, 0.0, 0.0);
        H = vec3(0.0, 0.0, 0.0);
    }
    else{    
        E = vec3(texelFetch(inE, ivec3(col, row, dep), 0));
        H = vec3(texelFetch(inH, ivec3(col, row, dep), 0));
    
        // if(tick < ${Math.max(sx, sy, sz)}){

            if(tick % 2 == 0){

                vec3 rotH = calcRot(0, E, H, col, row, dep);
                E = E + K * rotH;
            }
            else{
                vec3 rotE = calcRot(1, E, H, col, row, dep);
                H = H - rotE;
            }
        // }
    }

    if(col == ${sx} / 2 && row == ${sy} / 2 && dep == ${sz} / 2){
        E.z += 0.01 * sin(2.0 * PI * float(tick) / 200.0);
    }


    outPos = vec3(x, y, z);
    outE   = E;
    outH   = H;
}`;
}

//--------------------------------------------------
// 多体問題
//--------------------------------------------------

function multibody(cnt){ 
    return `

uniform mat4 uPMVMatrix;
uniform int   tick;

uniform sampler2D inPos;
uniform sampler2D inVel;
uniform sampler2D inMass;

out vec3 outPos;
out vec3 outVel;
out float dmp;

out vec4 fragmentColor;
    
void main(void) {
    int idx = int(gl_VertexID);

    vec3 pos = vec3(texelFetch(inPos, ivec2(idx, 0), 0));
    vec3 vel = vec3(texelFetch(inVel, ivec2(idx, 0), 0));
    if(tick % 1 == 0){

        float mass = texelFetch(inMass, ivec2(idx, 0), 0).r;
        dmp    = mass;

        vec3 F = vec3(0.0, 0.0, 0.0);
        for(int idx1 = 0; idx1 < ${cnt}; idx1++){
            vec3 pos1 = vec3(texelFetch(inPos, ivec2(idx1, 0), 0));
            float mass1 = texelFetch(inMass, ivec2(idx1, 0), 0).r;

            float r = length(pos1 - pos);
    
            if(r != 0.0){

                r *= 100.0;
                F += (mass * mass1 * 0.01 / (r * r)) * normalize(pos1 - pos);
            }
        }

        vel += F / mass;
        pos += vel;
    }

    if(gl_VertexID <= 1){

        gl_PointSize  = 4.0;
        fragmentColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
    else{

        gl_PointSize  = 2.0;
        fragmentColor = vec4(0.0, 0.0, 1.0, 1.0);
    }

    gl_Position   = uPMVMatrix * vec4(pos, 1.0);
    outPos = pos;
    outVel = vel;
}`;
}

function multibodyTest(gpgpu){
    let gl = bansho.gl;
    let sx = 20, sy = 20; sz = 20;
    let cnt = sx * sy * sz;
    let inPos = new Float32Array(sx * sy * sz * 3).map(x => 3 * Math.random() - 1.5);
    let inVel = new Float32Array(sx * sy * sz * 3).map(x => 0.05 * Math.random() - 0.025);
    let inMass  = new Float32Array(sx * sy * sz).map(x => 0.5 + Math.random());

    inPos = new Float32Array(sx * sy * sz * 3);
    inVel = new Float32Array(sx * sy * sz * 3);
    let cx = 0.7;
    for(let i = 6; i < inPos.length; i+= 3){
        let th = 2 * Math.PI * Math.random();
        let r = 0.5 + 40.0 * Math.random();
        let v = 0.4 * Math.random();
        inPos[i  ] = cx + r * Math.cos(th);
        inPos[i+1] = r * Math.sin(th);
        inPos[i+2] = 0.2 * Math.random() - 0.1;
        inVel[i  ] = - v * Math.sin(th);
        inVel[i+1] =   v * Math.cos(th);

        cx *= -1;
    }

    inMass[0] = 1000000;
    inPos[0] = 0.7;
   

    let dr = new gpgputs.UserDef(gl.POINTS, multibody(cnt) , gpgputs.GPGPU.pointFragmentShader,
    {
        inPos : gpgpu.makeTextureInfo("vec3" , [1, cnt], inPos),
        inVel : gpgpu.makeTextureInfo("vec3" , [1, cnt], inVel),
        inMass: gpgpu.makeTextureInfo("float", [1, cnt], inMass),
    });
    dr.numInput = sz * sy * sx;
    // dr.fps = 1;
    gpgpu.makePackage(dr);
    dr.bind("outPos", "inPos");
    dr.bind("outVel", "inVel");

    gpgpu.drawParam.z = -200;

    return dr;
}


//--------------------------------------------------
// 弾性衝突
//--------------------------------------------------

function particleShader(cnt, Cr){ 
    return `

uniform mat4 uPMVMatrix;
uniform int   tick;

uniform sampler2D inPos;
uniform sampler2D inVel;
uniform sampler2D inMass;

out vec3  outPos;
out vec3  outVel;
out float outMass;

out vec4 fragmentColor;

int rnd_cnt = 0;
float rnd(){
    return 2.0 * fract( sin(float(gl_VertexID) * 12.9898 + float(rnd_cnt++) * 78.233) * 43758.5453) - 1.0;
}

bool isNaN(float f){
    return !(-10000.0 < f && f <= 0.0 || 0.0 <= f && f < 10000.0);
}

void main(void) {
    vec3 pos;
    vec3 vel;

    float mass;

    if(tick == 0){
        pos = vec3(rnd(), rnd(), rnd());
        vel = vec3(0.1 * rnd(), 0.1 * rnd(), 0.1 * rnd());
        // vel = vec3(0.0, 0.0, 0.0);
        mass = 1.0 + abs(rnd());
    }
    else{
        pos  = vec3(texelFetch(inPos, ivec2(gl_VertexID, 0), 0));
        vel  = vec3(texelFetch(inVel, ivec2(gl_VertexID, 0), 0));
        mass = texelFetch(inMass, ivec2(gl_VertexID, 0), 0).r;

        vec3 F = vec3(0.0, 0.0, 0.0);
        vec3 dvel = vec3(0.0, 0.0, 0.0);
        for(int idx1 = 0; idx1 < ${cnt}; idx1++){
            vec3 pos1 = vec3(texelFetch(inPos, ivec2(idx1, 0), 0));
            vec3 vel1 = vec3(texelFetch(inVel, ivec2(idx1, 0), 0));
            float mass1 = texelFetch(inMass, ivec2(idx1, 0), 0).r;

            float r = length(pos1 - pos);
            if(r != 0.0 && r < 0.12){
                if(length((pos1 + + 0.1 * vel1) - (pos + 0.1 * vel)) < r){

                    // vec3 vel2 = 0.5 * (${Cr} * (vel1 - vel) + vel1 + vel);
                    vel = vel1;
                    // dvel += vel2 - vel;
                    // vel = vel2;
                    break;
                }
            }
        }

        // vel += dvel;
        vel.z -= 0.01;

        pos += vel;

        float bdr = 1.0;

        if(1.0 < abs(pos.x)){
            pos.x = sign(pos.x);
            if(1.0 < abs(pos.x + vel.x)){
                vel.x *= - ${Cr};
            }
        }

        if(1.0 < abs(pos.y)){
            pos.y = sign(pos.y);
            if(1.0 < abs(pos.y + vel.y)){
                vel.y *= - ${Cr};
            }
        }

        if(1.0 < abs(pos.z)){
            pos.z = sign(pos.z);
            if(1.0 < abs(pos.z + vel.z)){
                vel.z *= - ${Cr};
            }
        }

        pos.x = isNaN(pos.x) ? rnd() : pos.x;
        pos.y = isNaN(pos.y) ? rnd() : pos.y;
        pos.z = isNaN(pos.z) ? rnd() : pos.z;

        vel.x = isNaN(vel.x) ? rnd() : vel.x;
        vel.y = isNaN(vel.y) ? rnd() : vel.y;
        vel.z = isNaN(vel.z) ? rnd() : vel.z;
    }

    fragmentColor = vec4(1.0, 0.0, 0.0, 1.0);

    gl_Position   = uPMVMatrix * vec4(pos, 1.0);
    outPos  = pos;
    outVel  = vel;
    outMass = mass;
}`;
}

function ElasticCollision(gpgpu){
    let gl = bansho.gl;
    let sx = 20, sy = 20; sz = 20;
    let cnt = sz * sy * sx;
    let Cr = 0.9;

    let dr1 = new gpgputs.UserDef(gl.POINTS, particleShader(cnt, Cr) , gpgputs.GPGPU.pointFragmentShader,
    {
        inPos : gpgpu.makeTextureInfo("vec3" , [1, cnt]),
        inVel : gpgpu.makeTextureInfo("vec3" , [1, cnt]),
        inMass: gpgpu.makeTextureInfo("float", [1, cnt])
    });

    dr1.numInput = sz * sy * sx;
    gpgpu.makePackage(dr1);

    let dr2 = particlePackage(gpgpu, dr1.numInput, 8, 8, 0.01);

    let dr3 = new gpgputs.UserMesh(gl.TRIANGLES, CubeShader(), gpgputs.GPGPU.planeFragmentShader, 6 * 6);

    dr1.bind("outMass", "inMass");
    dr1.bind("outPos", "inPos");
    dr1.bind("outVel", "inVel");

    dr1.bind("outPos", "inPos", dr2);

    return new gpgputs.ComponentDrawable([dr1, dr2, dr3]);
}

//--------------------------------------------------
// 逆二乗
//--------------------------------------------------

function InverseSquareShader(cnt, Cr){ 
    return `

uniform mat4 uPMVMatrix;
uniform int   tick;

uniform sampler2D inPos;
uniform sampler2D inVel;
uniform sampler2D inMass;

out vec3  outPos;
out vec3  outVel;
out float outMass;

out vec4 fragmentColor;

int rnd_cnt = 0;
float rnd(){
    return 2.0 * fract( sin(float(gl_VertexID) * 12.9898 + float(rnd_cnt++) * 78.233) * 43758.5453) - 1.0;
}

bool isNaN(float f){
    return !(-10000.0 < f && f <= 0.0 || 0.0 <= f && f < 10000.0);
}

void main(void) {
    vec3 pos;
    vec3 vel;

    float mass;
    float bdr = 0.9;

    if(tick == 0){
        pos = bdr * vec3(rnd(), rnd(), rnd());
        vel = vec3(0.0, 0.0, 0.0);
        mass = 1.0;
    }
    else{
        pos  = vec3(texelFetch(inPos , ivec2(gl_VertexID, 0), 0));
        vel  = vec3(texelFetch(inVel , ivec2(gl_VertexID, 0), 0));
        mass =      texelFetch(inMass, ivec2(gl_VertexID, 0), 0).r;

        vec3 F = vec3(0.0, 0.0, 0.0);
        for(int idx1 = 0; idx1 < ${cnt}; idx1++){
            vec3 pos1   = vec3(texelFetch(inPos,  ivec2(idx1, 0), 0));
            vec3 vel1   = vec3(texelFetch(inVel,  ivec2(idx1, 0), 0));
            float mass1 =      texelFetch(inMass, ivec2(idx1, 0), 0).r;

            float r = length(pos1 - pos);
            if(0.0 < r && r < 0.1){

                F += 0.0001 * (pos - pos1) / r;
            }
        }

        vec3 gr = normalize(vec3(uPMVMatrix * vec4(0.0, 1.0, 0.0, 0.0)));
        vel -= 0.0001 * gr;

        // vel.z -= 0.0001;


        if(bdr < abs(pos.x) && abs(pos.x) <= abs(pos.x + vel.x) ){
            vel.x = ${Cr} * (- vel.x - sign(pos.x)*(abs(pos.x) - bdr));
        }

        if(-bdr > pos.y && abs(pos.y) <= abs(pos.y + vel.y) ){
            vel.y = - ${Cr} * (vel.y + bdr - abs(pos.y));
        }

        if(bdr < abs(pos.z) && abs(pos.z) <= abs(pos.z + vel.z) ){
            vel.z = ${Cr} * (- vel.z - sign(pos.z)*(abs(pos.z) - bdr));
        }

        vel += F;

        // vel += 0.001 * vec3(rnd(), rnd(), rnd());

        pos += vel;

        if(isNaN(length(pos))){
            pos = bdr * vec3(rnd(), rnd(), rnd());
        }

        if(isNaN(length(vel))){
            vel = vec3(0.0, 0.0, 0.0);
        }
    }

    fragmentColor = vec4(1.0, 0.0, 0.0, 1.0);

    gl_Position   = uPMVMatrix * vec4(pos, 1.0);
    outPos  = pos;
    outVel  = vel;
    outMass = mass;
}`;
}

function InverseSquare(gpgpu){
    let gl = bansho.gl;
    let sx = 20, sy = 20; sz = 10;
    let cnt = sz * sy * sx;
    let Cr = 0.5;

    let dr1 = new gpgputs.UserDef(gl.POINTS, InverseSquareShader(cnt, Cr) , gpgputs.GPGPU.pointFragmentShader,
    {
        inPos : gpgpu.makeTextureInfo("vec3" , [1, cnt]),
        inVel : gpgpu.makeTextureInfo("vec3" , [1, cnt]),
        inMass: gpgpu.makeTextureInfo("float", [1, cnt])
    });

    dr1.numInput = sz * sy * sx;
    gpgpu.makePackage(dr1);

    let dr2 = particlePackage(gpgpu, dr1.numInput, 8, 8, 0.04);

    let dr3 = new gpgputs.UserMesh(gl.TRIANGLES, CubeShader(), gpgputs.GPGPU.planeFragmentShader, 6 * 6);

    dr1.bind("outMass", "inMass");
    dr1.bind("outPos", "inPos");
    dr1.bind("outVel", "inVel");

    dr1.bind("outPos", "inPos", dr2);

    return new gpgputs.ComponentDrawable([dr1, dr2, dr3]);
}


//--------------------------------------------------
// バスタブ渦
//--------------------------------------------------

function BathtubVortexShader(cnt, Cr){ 
    return `

#define PI 3.14159265359

uniform mat4 uPMVMatrix;
uniform int   tick;

uniform sampler2D inPos;
uniform sampler2D inVel;
uniform sampler2D inMass;

out vec3  outPos;
out vec3  outVel;
out float outMass;

out vec4 fragmentColor;

int rnd_cnt = 0;
float rnd(){
    return 2.0 * fract( sin(float(gl_VertexID) * 12.9898 + float(rnd_cnt++) * 78.233) * 43758.5453) - 1.0;
}

bool isNaN(float f){
    return !(-10000.0 < f && f <= 0.0 || 0.0 <= f && f < 10000.0);
}

void main(void) {
    vec3 pos;
    vec3 vel;

    float mass;
    float bdr = 0.9;

    if(tick == 0){
        pos = bdr * vec3(rnd(), rnd(), rnd());
        vel = vec3(0.0, 0.0, 0.0);
        mass = 1.0;
    }
    else{
        pos  = vec3(texelFetch(inPos , ivec2(gl_VertexID, 0), 0));
        vel  = vec3(texelFetch(inVel , ivec2(gl_VertexID, 0), 0));
        mass =      texelFetch(inMass, ivec2(gl_VertexID, 0), 0).r;

        vec3 F = vec3(0.0, 0.0, 0.0);
        for(int idx1 = 0; idx1 < ${cnt}; idx1++){
            vec3 pos1   = vec3(texelFetch(inPos , ivec2(idx1, 0), 0));
            vec3 vel1   = vec3(texelFetch(inVel , ivec2(idx1, 0), 0));
            float mass1 =      texelFetch(inMass, ivec2(idx1, 0), 0).r;

            float r = length(pos1 - pos);
            if(0.0 < r && r < 0.1){

                F += 0.0001 * (pos - pos1) / r;
            }
        }

        vel.z -= 0.01;

        vec3 c = vec3(0.0, 0.0, 2.0);
        float r1 = length(c - pos);
        if(3.0 < r1){

            if(length(vec2(pos.x, pos.y)) < 0.1){

                float th = 2.0 * PI * sin(float(tick)) * rnd();
                pos.z = -0.6;
                float r2 = sqrt(3.0*3.0 - (c.z - pos.z)*(c.z - pos.z) );
                pos.x = r2 * cos(th);
                pos.y = r2 * sin(th);
                // vel = vec3(0.0, 0.0, 0.0);
                vel = 0.01 * vec3(pos.y, -pos.x, 0.0);
            }
            else{

                vel += 0.01 * normalize(c - pos);
                pos  = c + 3.0 * normalize(pos - c);
            }
        }

        vel += F;

        pos += vel;
    }

    fragmentColor = vec4(1.0, 0.0, 0.0, 1.0);

    gl_Position   = uPMVMatrix * vec4(pos, 1.0);
    outPos  = pos;
    outVel  = vel;
    outMass = mass;
}`;
}

function BathtubVortex(gpgpu){
    let gl = bansho.gl;
    let sx = 20, sy = 20; sz = 10;
    let cnt = sz * sy * sx;
    let Cr = 0.5;

    let dr1 = new gpgputs.UserDef(gl.POINTS, BathtubVortexShader(cnt, Cr) , gpgputs.GPGPU.pointFragmentShader,
    {
        inPos : gpgpu.makeTextureInfo("vec3" , [1, cnt]),
        inVel : gpgpu.makeTextureInfo("vec3" , [1, cnt]),
        inMass: gpgpu.makeTextureInfo("float", [1, cnt])
    });

    dr1.numInput = sz * sy * sx;
    gpgpu.makePackage(dr1);

    let dr2 = particlePackage(gpgpu, dr1.numInput, 8, 8, 0.04);

    // let dr3 = new gpgputs.UserMesh(gl.TRIANGLES, CubeShader(), gpgputs.GPGPU.planeFragmentShader, 6 * 6);

    dr1.bind("outMass", "inMass");
    dr1.bind("outPos", "inPos");
    dr1.bind("outVel", "inVel");

    dr1.bind("outPos", "inPos", dr2);

    return new gpgputs.ComponentDrawable([dr1, dr2]);
}


//--------------------------------------------------
// 曲面
//--------------------------------------------------

function SurfaceShader(sz){ 
    return `

${bansho.headShader}

uniform int   tick;

uniform sampler2D inPos;

${PseudoColor}

void main(void) {
    int idx = int(gl_VertexID);

    int ip  = idx % 2;
    idx    /= 2;

    int col  = idx % ${sz};
    int row  = idx / ${sz};
    if(ip == 1 && row + 1 < ${sz}){
        row++;
    }

    vec3 pos = vec3(texelFetch(inPos, ivec2(col, row), 0));

    vec3 x1 = pos, x2 = pos;
    vec3 y1 = pos, y2 = pos;

    if(0 <= col - 1){
        x1 = texelFetch(inPos, ivec2(col - 1, row), 0).xyz;
    }
    if(col + 1 < ${sz}){
        x2 = texelFetch(inPos, ivec2(col + 1, row), 0).xyz;
    }
    if(0 <= row - 1){
        y1 = texelFetch(inPos, ivec2(col, row - 1), 0).xyz;
    }
    if(row + 1 < ${sz}){
        y2 = texelFetch(inPos, ivec2(col, row + 1), 0).xyz;
    }

    vec3 nrm = normalize(cross(x2 - x1, y2 - y1));

    fragmentColor = vec4(PseudoColor(-0.01, 0.01, pos.z), 1.0);

    gl_Position = uPMVMatrix * vec4(pos, 1.0);

    float directionalLightWeighting = max(dot(nrm, uLightingDirection), 0.0);
    vLightWeighting = uAmbientColor + uDirectionalColor * directionalLightWeighting;
}`;
}

function surfaceWave(sz, K){ 
    return `
uniform int   tick;
    
uniform sampler2D inPos;
uniform sampler2D inVel;
out vec3 outPos;
out vec3 outVel;

#define PI 3.14159265359

${PseudoColor}

void main(void) {
    float L = 3.2 / float(${sz});
    float K = float(${K});

    int idx = int(gl_VertexID);

    int col  = idx % ${sz};
    int row  = idx / ${sz};

    vec3 vel = vec3(0.0, 0.0, 0.0);

    float x = -1.6 + float(col) * L;
    float y = -1.6 + float(row) * L;
    float z = 0.0;

    if(row == ${sz} / 2 && col == ${sz} / 2){

        z = 0.2 * cos(float(tick) / 100.0);
    }
    else if(col == 0 || row == 0 || col == ${sz} - 1 || row == ${sz} - 1){
        z = 0.0;
    }
    else{
        if(tick == 0){

        }
        else{

            vec3 p  = texelFetch(inPos, ivec2(col, row), 0).xyz;
            vel     = texelFetch(inVel, ivec2(col, row), 0).xyz;

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

                vec3 p1 = texelFetch(inPos, ivec2(col1, row1), 0).xyz;

                float l1 = length(p1 - p);
                l1 = sqrt(2.0 * L * L + (p1.z - p.z) * (p1.z - p.z));
                float f1 = K * (l1 - L);
                float a1 = f1 * ((p1.z - p.z) / l1);

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

    outPos        = vec3(x, y, z);
    outVel        = vel;
}`;
}

function testSurface(gpgpu){ 
    let gl = bansho.gl;
    const sz = 512;
    let dr1 = new gpgputs.UserDef(gl.POINTS, surfaceWave(sz, 0.2) , gpgputs.GPGPU.minFragmentShader,
    {
        pointSize: 1,
        inPos : gpgpu.makeTextureInfo("vec3", [sz, sz]),
        inVel : gpgpu.makeTextureInfo("vec3", [sz, sz]),
        outPos: new Float32Array(sz * sz * 3),
        outVel: new Float32Array(sz * sz * 3)
    });
    dr1.numInput = sz * sz;

    let dr2 = new gpgputs.UserDef(bansho.gl.TRIANGLE_STRIP, SurfaceShader(sz), gpgputs.GPGPU.planeFragmentShader, {
        inPos : gpgpu.makeTextureInfo("vec3", [sz, sz]),
    });
    dr2.numInput = sz * sz * 2;
    dr2.numGroup = sz * 2;

    gpgpu.makePackage(dr1);
    gpgpu.makePackage(dr2);

    dr1.bind("outPos", "inPos");
    dr1.bind("outVel", "inVel");

    dr1.bind("outPos", "inPos", dr2);

    return new gpgputs.ComponentDrawable([dr1, dr2]);
}

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

function ArrowLine(gpgpu, dr1, pos_name, vec_name, cnt, r, g, b){
    let [ sy, sx ] = bansho.Factorization(cnt);
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
    let [ sy, sx ] = bansho.Factorization(cnt);
    console.log(`3D矢印 因数分解 ${cnt} = ${sy} x ${sx}`);

    const npt = 9;
    let dr2 = new gpgputs.UserDef(bansho.gl.TRIANGLE_FAN, ArrowFanShader(npt, sx, r, g, b), gpgputs.GPGPU.planeFragmentShader, {
        inPos : gpgpu.makeTextureInfo("vec3", [sy, sx]),
        inVec : gpgpu.makeTextureInfo("vec3", [sy, sx])
    });
    dr2.numInput = cnt * 3 * npt;
    dr2.numGroup = npt;

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
// 3D矢印のテスト
//--------------------------------------------------

function testArrow3D(gpgpu){
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
// 1D矢印のテスト
//--------------------------------------------------

let Arrow1DShader = `
precision highp sampler3D;

uniform sampler2D inPos;
uniform sampler2D inVec;

uniform mat4 uPMVMatrix;
uniform mat3 uNMatrix;
uniform int   tick;

out vec4 fragmentColor;


void main(void) {
    int sx = textureSize(inPos, 0).x;

    int idx = int(gl_VertexID);

    int ip  = idx % 2;
    idx    /= 2;

    int row  = idx / sx;
    int col  = idx % sx;

    vec3 pos = vec3(texelFetch(inPos, ivec2(col, row), 0));

    if(ip == 1){

        vec3 vec = vec3(texelFetch(inVec, ivec2(col, row), 0));
        pos += vec;
    }

    if(ip == 0){

        fragmentColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
    else{

        fragmentColor = vec4(0.0, 0.0, 1.0, 1.0);
    }
    // fragmentColor = vec4(abs(pos.x), abs(pos.y), abs(pos.z), 1.0);

    gl_PointSize  = 5.0;
    gl_Position = uPMVMatrix * vec4(pos, 1.0);
}`;


function Arrow1D(gpgpu, dr1, pos_name, dr2, vec_name, cnt){
    let [ sy, sx ] = bansho.Factorization(cnt);
    console.log(`3D矢印 因数分解 ${cnt} = ${sy} x ${sx}`);

    let dr3 = new gpgputs.UserDef(bansho.gl.LINES, Arrow1DShader, gpgputs.GPGPU.pointFragmentShader, {
        inPos : gpgpu.makeTextureInfo("vec3", [sy, sx]),
        inVec : gpgpu.makeTextureInfo("vec3", [sy, sx])
    });
    dr3.numInput = cnt * 2;

    gpgpu.makePackage(dr3);

    dr1.bind(pos_name, "inPos", dr3);
    dr2.bind(vec_name, "inVec", dr3);

    return dr3;
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
    float L = 3.2 / float(max(${sx}, max(${sy},${sz})));
    float K = float(${K});

    int idx = int(gl_VertexID);

    int col  = idx % ${sx};
    idx     /= ${sx};

    int row  = idx % ${sy};
    int dep  = idx / ${sy};

    float x = float(col - ${sx}/2) * L;
    float y = float(row - ${sy}/2) * L;
    float z = float(dep - ${sz}/2) * L;

    vec3 E, H;

    if(tick == 0){
        E = vec3(0.0, 0.0, 0.0);
        H = vec3(0.0, 0.0, 0.0);
    }
    else{    
        E = vec3(texelFetch(inE, ivec3(col, row, dep), 0));
        H = vec3(texelFetch(inH, ivec3(col, row, dep), 0));
    
        // if(tick < max(${sx}, max(${sy},${sz}))){

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

let ElasticCollisionShader = `

const float Cr = 0.9;

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
    int cnt = textureSize(inPos, 0).x;
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
        for(int idx1 = 0; idx1 < cnt; idx1++){
            vec3 pos1 = vec3(texelFetch(inPos, ivec2(idx1, 0), 0));
            vec3 vel1 = vec3(texelFetch(inVel, ivec2(idx1, 0), 0));
            float mass1 = texelFetch(inMass, ivec2(idx1, 0), 0).r;

            float r = length(pos1 - pos);
            if(r != 0.0 && r < 0.12){
                if(length((pos1 + + 0.1 * vel1) - (pos + 0.1 * vel)) < r){

                    // vec3 vel2 = 0.5 * (Cr * (vel1 - vel) + vel1 + vel);
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
                vel.x *= - Cr;
            }
        }

        if(1.0 < abs(pos.y)){
            pos.y = sign(pos.y);
            if(1.0 < abs(pos.y + vel.y)){
                vel.y *= - Cr;
            }
        }

        if(1.0 < abs(pos.z)){
            pos.z = sign(pos.z);
            if(1.0 < abs(pos.z + vel.z)){
                vel.z *= - Cr;
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

function surfaceWave(){ 
    return `
uniform int   tick;
    
uniform sampler2D inPos;
uniform sampler2D inVel;
out vec3 outPos;
out vec3 outVel;

#define PI 3.14159265359

${PseudoColor}

void main(void) {
    int sz = textureSize(inPos, 0).x;
    float L = 3.2 / float(sz);
    float K = 0.2;

    int idx = int(gl_VertexID);

    int col  = idx % sz;
    int row  = idx / sz;

    vec3 vel = vec3(0.0, 0.0, 0.0);

    float x = -1.6 + float(col) * L;
    float y = -1.6 + float(row) * L;
    float z = 0.0;

    if(row == sz / 2 && col == sz / 2){

        z = 0.2 * cos(float(tick) / 100.0);
    }
    else if(col == 0 || row == 0 || col == sz - 1 || row == sz - 1){
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

                if(col1 < 0 || row1 < 0 || col1 == sz || row1 == sz){
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
    let dr1 = new gpgputs.UserDef(gl.POINTS, surfaceWave() , gpgputs.GPGPU.minFragmentShader,
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

//--------------------------------------------------
// D2Q9-1
//--------------------------------------------------


let D2Q9Shader = `
precision highp sampler3D;

#define PI 3.14159265359

uniform int   tick;

uniform sampler2D inVec;
uniform sampler2D inF0;
uniform sampler3D inF1;
uniform sampler3D inF2;

out float outF0;
out vec4  outF1;
out vec4  outF2;

out vec3 outVec;

#define C   1.5
#define C2  (1.0 / (C * C))
#define C4  (C2 * C2)

void main(void) {
    int sx = textureSize(inF1, 0).y;
    int sy = textureSize(inF1, 0).z;

    int idx = int(gl_VertexID);

    int iy  = idx / sx;
    int ix  = idx % sx;

    if(tick == 0){

        outF0 = 0.0;
        outF1 = vec4(0.0, 0.0, 0.0, 0.0);
        outF2 = vec4(0.0, 0.0, 0.0, 0.0);

        outVec = vec3(0.0, 0.0, 0.0);

        if(ix == sx / 2 && iy == sy / 2){
            outF1 = vec4(1.0, 1.0, 1.0, 1.0);
        }

        return;
    }

    float f1[4], f2[4];

    float f0 = texelFetch(inF0, ivec2(   ix, iy), 0).r;
    for(int i = 0; i < 4; i++){
        f1[i] = texelFetch(inF1, ivec3(i, ix, iy), 0).r;
        f2[i] = texelFetch(inF2, ivec3(i, ix, iy), 0).r;
    }

    if(sx <= tick){
        outF0 = f0;
        outF1 = vec4(f1[0], f1[1], f1[2], f1[3]);
        outF2 = vec4(f2[0], f2[1], f2[2], f2[3]);
        outVec = texelFetch(inVec, ivec2(ix, iy), 0).xyz;
        return;
    }

    if(tick % 2 == 1){

        float rho = f0 + f1[0] + f1[1] + f1[2] + f1[3]
                       + f2[0] + f2[1] + f2[2] + f2[3];

        float ux = (f1[1] - f1[0]) + (f2[1] + f2[3]) - (f2[0] + f2[2]);
        float uy = (f1[3] - f1[2]) + (f2[2] + f2[3]) - (f2[0] + f2[1]);

        if(rho != 0.0){
            ux /= rho;
            uy /= rho;
        }
        vec2 u = vec2(ux, uy);

        vec2  ei;
        float wi;
        for(int i = 0; i < 9; i++){
            switch(i){
            case 0: ei = vec2( 0.0,  0.0); wi = 4.0 /  9.0; break;

            case 1: ei = vec2(-1.0,  0.0); wi = 1.0 /  9.0; break;
            case 2: ei = vec2( 1.0,  0.0); wi = 1.0 /  9.0; break;
            case 3: ei = vec2( 0.0, -1.0); wi = 1.0 /  9.0; break;
            case 4: ei = vec2( 0.0,  1.0); wi = 1.0 /  9.0; break;

            case 5: ei = vec2(-1.0, -1.0); wi = 1.0 / 36.0; break;
            case 6: ei = vec2( 1.0, -1.0); wi = 1.0 / 36.0; break;
            case 7: ei = vec2(-1.0,  1.0); wi = 1.0 / 36.0; break;
            case 8: ei = vec2( 1.0,  1.0); wi = 1.0 / 36.0; break;
            }

            ei *= C;

            float ei_u = dot(ei, u);
            float feq = wi * rho * (1.0 + ei_u * (3.0 * C2) + ei_u * ei_u * (9.0 * C4 / 2.0) - dot(u, u) * (3.0 * C2 / 2.0) );

            float tau = 0.1;
            if(i == 0){
                f0 += tau * (feq - f0);
            }
            else if(i <= 4){
                f1[i - 1] += tau * (feq - f1[i - 1]);
            }
            else{
                f2[i - 5] += tau * (feq - f2[i - 5]);
            }
        }

        outVec = 0.1 * vec3(u, 0.0);
    }
    else{
        outVec = texelFetch(inVec, ivec2(ix, iy), 0).xyz;

        for(int i = 0; i < 4; i++){
            int ix1 = ix, iy1 = iy;

            //    3
            //  0   1
            //    2

            switch(i){
                case 0: ix1++; break;
                case 1: ix1--; break;
                case 2: iy1++; break;
                case 3: iy1--; break;
            }

            if(0 <= ix1 && ix1 < sx && 0 <= iy1 && iy1 < sy){
                f1[i] = texelFetch(inF1, ivec3(i, ix1, iy1), 0).r;
            }
            else{
                f1[i] = 0.0;
            }

            ix1 = ix, iy1 = iy;

            //  2   3
            //  
            //  0   1

            switch(i){
                case 0: ix1++; iy1++; break;
                case 1: ix1--; iy1++; break;
                case 2: ix1++; iy1--; break;
                case 3: ix1--; iy1--; break;
            }

            if(0 <= ix1 && ix1 < sx && 0 <= iy1 && iy1 < sy){
                f2[i] = texelFetch(inF2, ivec3(i, ix1, iy1), 0).r;
            }
            else{
                f2[i] = 0.0;
            }
        }
    }

    outF0 = f0;
    outF1 = vec4(f1[0], f1[1], f1[2], f1[3]);
    outF2 = vec4(f2[0], f2[1], f2[2], f2[3]);
}`;

function D2Q9pos(sy, sx){
    return `

out vec3 pos;

void main(void) {
    int idx = int(gl_VertexID);

    int iy  = idx / ${sx};
    int ix  = idx % ${sx};

    float x = 2.0 * float(ix) / float(${sx}) - 1.0;
    float y = 2.0 * float(iy) / float(${sy}) - 1.0;
    float z = 0.0;

    pos = vec3(x, y, z);
}`;
}

function testD2Q9_1(gpgpu){
    let gl = bansho.gl;
    let sy = 500, sx = 500;

    let dr1 = new gpgputs.UserDef(gl.POINTS, D2Q9Shader, gpgputs.GPGPU.minFragmentShader,
    {
        inVec: gpgpu.makeTextureInfo("vec3" , [sy, sx]),
        inF0 : gpgpu.makeTextureInfo("float", [sy, sx]),
        inF1 : gpgpu.makeTextureInfo("float", [sy, sx, 4]),
        inF2 : gpgpu.makeTextureInfo("float", [sy, sx, 4]),
        outF0: new Float32Array(sy * sx),
        outF1: new Float32Array(sy * sx * 4),
        outF2: new Float32Array(sy * sx * 4),
        // pos  : new Float32Array(sy * sx * 3),
        outVec  : new Float32Array(sy * sx * 3)
    });
    dr1.numInput = sy * sx;
    gpgpu.makePackage(dr1);

    let dr2 = new gpgputs.UserDef(gl.POINTS, D2Q9pos(sy, sx), gpgputs.GPGPU.minFragmentShader,
        {
            pos  : new Float32Array(sy * sx * 3),
        });
    dr2.numInput = sy * sx;
    gpgpu.makePackage(dr2);

    dr1.bind("outF0", "inF0");
    dr1.bind("outF1", "inF1");
    dr1.bind("outF2", "inF2");
    dr1.bind("outVec", "inVec");

    let dr3 = Arrow1D(gpgpu, dr2, "pos", dr1, "outVec", dr1.numInput);
    return new gpgputs.ComponentDrawable([dr1, dr2, dr3]);
}

//--------------------------------------------------
// D2Q9-2
//--------------------------------------------------

let D2Q9_F_1 = `
precision highp sampler3D;

uniform int   tick;

uniform sampler3D inF;

out float outF;

void main(void) {
    int sx = textureSize(inF, 0).y;
    int sy = textureSize(inF, 0).z;

    int idx = int(gl_VertexID);

    int ip  = idx % 9;
    idx    /= 9;

    int iy  = idx / sx;
    int ix  = idx % sx;

    if(tick == 0){

        outF = 0.0;

        if(ix == sx / 2 && iy == sy / 2){
            if(1 <= ip && ip <= 4){
                outF = 1.0 / float(sx);
            }
        }

        return;
    }

    if(sx / 2 <= tick){
        outF = texelFetch(inF, ivec3(ip, ix, iy), 0).r;
        return;
    }
        
    int ix1 = ix, iy1 = iy;

    // 7  4  8
    // 1  0  2
    // 5  3  6

    switch(ip){
        case 1: ix1++; break;
        case 2: ix1--; break;
        case 3: iy1++; break;
        case 4: iy1--; break;

        case 5: ix1++; iy1++; break;
        case 6: ix1--; iy1++; break;
        case 7: ix1++; iy1--; break;
        case 8: ix1--; iy1--; break;
    }

    if(0 <= ix1 && ix1 < sx && 0 <= iy1 && iy1 < sy){
        outF = texelFetch(inF, ivec3(ip, ix1, iy1), 0).r;
    }
    else{
        outF = 0.0;
    }
}`;

let D2Q9_RhoVelPos = `
precision highp sampler3D;

uniform sampler3D inF;

out vec3  outPos;
out float outRho;
out vec3  outVel;

void main(void) {
    int idx = int(gl_VertexID);

    int sx = textureSize(inF, 0).y;
    int sy = textureSize(inF, 0).z;

    int iy  = idx / sx;
    int ix  = idx % sx;

    float x = 2.0 * float(ix) / float(sx) - 1.0;
    float y = 2.0 * float(iy) / float(sy) - 1.0;
    float z = 0.0;

    float f[9];
    float rho = 0.0;
    for(int i = 0; i < 9; i++){
        f[i] = texelFetch(inF, ivec3(i, ix, iy), 0).r;
        rho += f[i];
    }

    // 7  4  8
    // 1  0  2
    // 5  3  6

    float ux = (f[6] + f[2] + f[8]) - (f[5] + f[1] + f[7]);
    float uy = (f[7] + f[4] + f[8]) - (f[5] + f[3] + f[6]);

    if(rho != 0.0){
        ux /= rho;
        uy /= rho;
    }

    outVel = 0.1 * vec3(ux, uy, 0.0);
    outPos = vec3(x, y, z);
    outRho = rho;
}`;


let D2Q9_F_2 = `
precision highp sampler3D;

uniform int   tick;

uniform sampler2D inRho;
uniform sampler2D inVel;
uniform sampler3D inF;

out float outF;

#define C   1.5
#define C2  (1.0 / (C * C))
#define C4  (C2 * C2)

void main(void) {
    float tau = 0.1;

    int sx = textureSize(inF, 0).y;
    int sy = textureSize(inF, 0).z;

    int idx = int(gl_VertexID);

    int ip  = idx % 9;
    idx    /= 9;

    int iy  = idx / sx;
    int ix  = idx % sx;

    if(sx / 2 <= tick){
        outF = texelFetch(inF, ivec3(ip, ix, iy), 0).r;
        return;
    }

    vec2  ei;
    float wi;

    switch(ip){
    case 0: ei = vec2( 0.0,  0.0); wi = 4.0 /  9.0; break;

    case 1: ei = vec2(-1.0,  0.0); wi = 1.0 /  9.0; break;
    case 2: ei = vec2( 1.0,  0.0); wi = 1.0 /  9.0; break;
    case 3: ei = vec2( 0.0, -1.0); wi = 1.0 /  9.0; break;
    case 4: ei = vec2( 0.0,  1.0); wi = 1.0 /  9.0; break;

    case 5: ei = vec2(-1.0, -1.0); wi = 1.0 / 36.0; break;
    case 6: ei = vec2( 1.0, -1.0); wi = 1.0 / 36.0; break;
    case 7: ei = vec2(-1.0,  1.0); wi = 1.0 / 36.0; break;
    case 8: ei = vec2( 1.0,  1.0); wi = 1.0 / 36.0; break;
    }

    ei *= C;

    float rho = texelFetch(inRho, ivec2(ix, iy), 0).r;
    vec3  vec = texelFetch(inVel, ivec2(ix, iy), 0).xyz;
    float f   = texelFetch(inF  , ivec3(ip, ix, iy), 0).r;

    vec2 u    = vec2(vec.x, vec.y);

    float ei_u = dot(ei, u);
    float feq = wi * rho * (1.0 + ei_u * (3.0 * C2) + ei_u * ei_u * (9.0 * C4 / 2.0) - dot(u, u) * (3.0 * C2 / 2.0) );

    outF = f + tau * (feq - f);
}

`;

function testD2Q9_2(gpgpu){
    let gl = bansho.gl;
    let sy = 500, sx = 500;

    let dr1 = new gpgputs.UserDef(gl.POINTS, D2Q9_F_1, gpgputs.GPGPU.minFragmentShader,
    {
        inF : gpgpu.makeTextureInfo("float", [sy, sx, 9]),
        outF: new Float32Array(sy * sx * 9),
    });
    dr1.numInput = sy * sx * 9;

    let dr2 = new gpgputs.UserDef(gl.POINTS, D2Q9_RhoVelPos, gpgputs.GPGPU.minFragmentShader,
    {
        inF     : gpgpu.makeTextureInfo("float", [sy, sx, 9]),
        outPos  : new Float32Array(sy * sx * 3),
        outRho  : new Float32Array(sy * sx),
        outVel  : new Float32Array(sy * sx * 3)
    });
    dr2.numInput = sy * sx;

    let dr3 = new gpgputs.UserDef(gl.POINTS, D2Q9_F_2, gpgputs.GPGPU.minFragmentShader,
    {
        inRho : gpgpu.makeTextureInfo("float", [sy, sx]),
        inVel : gpgpu.makeTextureInfo("vec3" , [sy, sx]),
        inF   : gpgpu.makeTextureInfo("float", [sy, sx, 9]),
        outF  : new Float32Array(sy * sx * 9),
    });
    dr3.numInput = sy * sx * 9;
    
    gpgpu.makePackage(dr1);
    gpgpu.makePackage(dr2);
    gpgpu.makePackage(dr3);

    dr1.bind("outF", "inF", dr2);
    dr1.bind("outF", "inF", dr3);

    dr2.bind("outRho", "inRho", dr3);
    dr2.bind("outVel", "inVel", dr3);
    
    dr3.bind("outF", "inF", dr1);


    let dr4 = Arrow1D(gpgpu, dr2, "outPos", dr2, "outVel", dr2.numInput);

    return new gpgputs.ComponentDrawable([dr1, dr2, dr3, dr4]);
}


//--------------------------------------------------
// D3Q15
//--------------------------------------------------

let D3Q15_head_1 = `
int sx = textureSize(inF, 0).x / 15;
int sy = textureSize(inF, 0).y;
int sz = textureSize(inF, 0).z;

int idx = int(gl_VertexID);

int ip  = idx % 15;
idx    /= 15;

int ix  = idx % sx;
idx    /= sx;

int iy  = idx % sy;
int iz  = idx / sy;
`;

let D3Q15_head_2 = `
int sx = textureSize(inF, 0).x / 15;
int sy = textureSize(inF, 0).y;
int sz = textureSize(inF, 0).z;

int idx = int(gl_VertexID);

int ix  = idx % sx;
idx    /= sx;

int iy  = idx % sy;
int iz  = idx / sy;
`;

let eTbl = `
const int E[15 * 3] = int[](
    0,  0,  0,

   -1,  0,  0,
    1,  0,  0,
    0, -1,  0,
    0,  1,  0,
    0,  0, -1,
    0,  0,  1,

   -1, -1, -1,
   -1, -1,  1,

   -1,  1, -1,
   -1,  1,  1,

    1, -1, -1,
    1, -1,  1,

    1,  1, -1,
    1,  1,  1
);
`;

let D3Q15_F_1 = `
precision highp sampler3D;

uniform int   tick;

uniform sampler3D inF;

out float outF;

${eTbl}

void main(void) {
    ${D3Q15_head_1}

    if(tick == 0){

        outF = 0.0;

        if(ix == sx / 2 && iy == sy / 2 && iz == sz / 2){
            if(1 <= ip && ip <= 6){
                outF = 1.0 / float(sx);
            }
        }

        return;
    }

    if(sx / 2 <= tick){
        outF = texelFetch(inF, ivec3(ip + 15 * ix, iy, iz), 0).r;
        return;
    }
        
    int j = ip * 3;
    int ix1 = ix - E[j  ];
    int iy1 = iy - E[j+1];
    int iz1 = iz - E[j+2];

    if(0 <= ix1 && ix1 < sx && 0 <= iy1 && iy1 < sy){
        outF = texelFetch(inF, ivec3(ip + 15 * ix1, iy1, iz1), 0).r;
    }
    else{
        outF = 0.0;
    }
}`;

let D3Q15_RhoVelPos = `
precision highp sampler3D;

uniform sampler3D inF;

out vec3  outPos;
out float outRho;
out vec3  outVel;

${eTbl}

void main(void) {
    ${D3Q15_head_2}

    float x = 2.0 * float(ix) / float(sx) - 1.0;
    float y = 2.0 * float(iy) / float(sy) - 1.0;
    float z = 2.0 * float(iz) / float(sz) - 1.0;

    float f[15];
    float rho = 0.0;

    vec3 u = vec3(0.0, 0.0, 0.0);
    for(int i = 0; i < 15; i++){
        float t = texelFetch(inF, ivec3(i + 15 * ix, iy, iz), 0).r;

        f[i] = t;
        rho += f[i];

        int base = i * 3;
        u += t * vec3(float(E[base]), float(E[base + 1]), float(E[base + 2]));
    }

    if(rho != 0.0){
        u /= rho;
    }

    outVel = 0.1 * u;
    outPos = vec3(x, y, z);
    outRho = rho;
}`;


let D3Q15_F_2 = `
precision highp sampler3D;

uniform int   tick;

uniform sampler3D inRho;
uniform sampler3D inVel;
uniform sampler3D inF;

out float outF;

#define C   1.5
#define C2  (1.0 / (C * C))
#define C4  (C2 * C2)

${eTbl}

void main(void) {
    float tau = 0.1;
    ${D3Q15_head_1}

    if(sx / 2 <= tick){
        outF = texelFetch(inF, ivec3(ip + 15 * ix, iy, iz), 0).r;
        return;
    }

    vec3  ei;
    float wi;

    if(ip == 0){
        wi = 1.0 / 3.0;
    }
    else if(1 <= ip && ip <= 6){
        wi = 1.0 / 18.0;
    }
    else{
        wi = 1.0 / 36.0;
    }

    int j = 3 * ip;
    ei = vec3(float(E[j]), float(E[j+1]), float(E[j+2]));

    ei *= C;

    float rho = texelFetch(inRho, ivec3(ix, iy, iz), 0).r;
    vec3  u   = texelFetch(inVel, ivec3(ix, iy, iz), 0).xyz;
    float f   = texelFetch(inF  , ivec3(ip + 15 * ix, iy, iz), 0).r;

    float ei_u = dot(ei, u);
    float feq = wi * rho * (1.0 + ei_u * (3.0 * C2) + ei_u * ei_u * (9.0 * C4 / 2.0) - dot(u, u) * (3.0 * C2 / 2.0) );

    outF = f + tau * (feq - f);
}

`;

function testD3Q15(gpgpu){
    let gl = bansho.gl;
    let sz = 50, sy = 50, sx = 100;

    let dr1 = new gpgputs.UserDef(gl.POINTS, D3Q15_F_1, gpgputs.GPGPU.minFragmentShader,
    {
        inF : gpgpu.makeTextureInfo("float", [sz, sy, sx * 15]),
        outF: new Float32Array(sz * sy * sx * 15),
    });
    dr1.numInput = sz * sy * sx * 15;

    let dr2 = new gpgputs.UserDef(gl.POINTS, D3Q15_RhoVelPos, gpgputs.GPGPU.minFragmentShader,
    {
        inF     : gpgpu.makeTextureInfo("float", [sz, sy, sx * 15]),
        outPos  : new Float32Array(sz * sy * sx * 3),
        outRho  : new Float32Array(sz * sy * sx),
        outVel  : new Float32Array(sz * sy * sx * 3)
    });
    dr2.numInput = sz * sy * sx;

    let dr3 = new gpgputs.UserDef(gl.POINTS, D3Q15_F_2, gpgputs.GPGPU.minFragmentShader,
    {
        inRho : gpgpu.makeTextureInfo("float", [sz, sy, sx]),
        inVel : gpgpu.makeTextureInfo("vec3" , [sz, sy, sx]),
        inF   : gpgpu.makeTextureInfo("float", [sz, sy, sx * 15]),
        outF  : new Float32Array(sz * sy * sx * 15),
    });
    dr3.numInput = sz * sy * sx * 15;
    
    gpgpu.makePackage(dr1);
    gpgpu.makePackage(dr2);
    gpgpu.makePackage(dr3);

    dr1.bind("outF", "inF", dr2);
    dr1.bind("outF", "inF", dr3);

    dr2.bind("outRho", "inRho", dr3);
    dr2.bind("outVel", "inVel", dr3);
    
    dr3.bind("outF", "inF", dr1);


    let dr4 = Arrow1D(gpgpu, dr2, "outPos", dr2, "outVel", dr2.numInput);

    return new gpgputs.ComponentDrawable([dr1, dr2, dr3, dr4]);
}


//--------------------------------------------------
// 直方体
//--------------------------------------------------

function Cuboid(gpgpu, points, depth){
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

function testCuboid(gpgpu){
    // return Cuboid(gpgpu, [ [0, 0, 0], [0.5, 0, 0], [0, 0.5, 0] ], 0.7);
    return Cuboid(gpgpu, [ [-1.0, -1.0, 0], [1.0, -1.0, 0], [-1.0, 1.0, 0] ], 1.0);
}
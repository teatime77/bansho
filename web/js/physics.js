
//--------------------------------------------------
// 
//--------------------------------------------------

function getIndex(sz, sy, sx){
return `
    int col  = idx % ${sx};
    idx     /= ${sx};

    int row  = idx % ${sy};
    int dep  = idx / ${sy};
`;
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
// 線の矢印
//--------------------------------------------------

function ArrowLineShader(sx, sy, sz, r, g, b){ 
    return `

precision highp sampler3D;

uniform mat4 uPMVMatrix;
uniform mat3 uNMatrix;

uniform sampler3D inPos;
uniform sampler3D inVec;

out vec4 fragmentColor;

void main(void) {
    int idx = int(gl_VertexID);

    int ip  = idx % 2;
    idx    /= 2;

    int col  = idx % ${sx};
    idx     /= ${sx};

    int row  = idx % ${sy};
    int dep  = idx / ${sy};

    vec4 pos = texelFetch(inPos, ivec3(col, row, dep), 0);

    if(ip == 1){
        vec4 vec = texelFetch(inVec, ivec3(col, row, dep), 0);
        pos += vec;
    }

    fragmentColor = vec4(float(${r}), float(${g}), float(${b}), 1.0);

    gl_Position = uPMVMatrix * vec4(vec3(pos), 1.0);
}`;
}



function ArrowLine(gpgpu, dr1, pos_name, vec_name, sx, sy, sz, r, g, b){
    let dr2 = new gpgputs.UserDef(bansho.gl.LINES, ArrowLineShader(sx, sy, sz, r, g, b), gpgputs.GPGPU.pointFragmentShader, 
    {
        inPos : gpgpu.makeTextureInfo("vec3", [sz, sy, sx]),
        inVec : gpgpu.makeTextureInfo("vec3", [sz, sy, sx]),
    });
    dr2.numInput = sz * sy * sx * 2;
    bansho.glb.view.gpgpu.makePackage(dr2);

    dr1.bind(pos_name, "inPos", dr2);
    dr1.bind(vec_name, "inVec", dr2);

    return dr2;
}


//--------------------------------------------------
// 3D矢印
//--------------------------------------------------

function Arrow3D(gpgpu, dr1, pos_name, vec_name, sx, sy, sz, r, g, b){
    let size = sx * sy * sz;
    const npt = 9;
    let dr2 = new gpgputs.UserDef(bansho.gl.TRIANGLE_FAN, ArrowFanShader(npt, sx, sy, sz, r, g, b), gpgputs.GPGPU.planeFragmentShader, {
        inPos : gpgpu.makeTextureInfo("vec3", [sz, sy, sx]),
        inVec : gpgpu.makeTextureInfo("vec3", [sz, sy, sx])
    });
    dr2.numInput = size * 3 * 9;
    dr2.numGroup = 9;

    let dr3 = new gpgputs.UserDef(bansho.gl.TRIANGLE_STRIP, ArrowTubeShader(npt, sx, sy, sz, r, g, b), gpgputs.GPGPU.planeFragmentShader, {
        inPos : gpgpu.makeTextureInfo("vec3", [sz, sy, sx]),
        inVec : gpgpu.makeTextureInfo("vec3", [sz, sy, sx])
    });
    dr3.numInput = size * 2 * npt;
    dr3.numGroup = 2 * npt;

    bansho.glb.view.gpgpu.makePackage(dr2);
    bansho.glb.view.gpgpu.makePackage(dr3);

    dr1.bind(pos_name, "inPos", dr2);
    dr1.bind(vec_name, "inVec", dr2);

    dr1.bind(pos_name, "inPos", dr3);
    dr1.bind(vec_name, "inVec", dr3);

    return new gpgputs.ComponentDrawable([dr1, dr2, dr3]);
}


//--------------------------------------------------
// 矢印の円錐と円
//--------------------------------------------------

function ArrowFanShader(npt, sx, sy, sz, r, g, b){ 
    return `

precision highp sampler3D;

${bansho.headShader}

uniform int   tick;

uniform sampler3D inPos;
uniform sampler3D inVec;

void main(void) {
    int idx = int(gl_VertexID);

    int ip  = idx % ${npt};
    idx /= ${npt};

    int mod = idx % 3;
    idx /= 3;

    int col  = idx % ${sx};
    idx     /= ${sx};
    int row  = idx % ${sy};
    int dep  = idx / ${sy};

    vec3 pos = vec3(texelFetch(inPos, ivec3(col, row, dep), 0));
    vec3 vec = vec3(texelFetch(inVec, ivec3(col, row, dep), 0));

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

function ArrowTubeShader(npt, sx, sy, sz, r, g, b){ 
    return `

precision highp sampler3D;

${bansho.headShader}

uniform int   tick;

uniform sampler3D inPos;
uniform sampler3D inVec;

void main(void) {
    int idx = int(gl_VertexID);

    int lh  = idx % 2;
    idx /= 2;

    int ip  = idx % ${npt};
    idx /= ${npt};

    int col  = idx % ${sx};
    idx     /= ${sx};
    int row  = idx % ${sy};
    int dep  = idx / ${sy};

    vec3 pos = vec3(texelFetch(inPos, ivec3(col, row, dep), 0));
    vec3 vec = vec3(texelFetch(inVec, ivec3(col, row, dep), 0));

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

function particlePackage(gpgpu, sz, sy, sx, n1, n2, radius){
    let shader = `

precision highp sampler3D;

const vec3 uAmbientColor = vec3(0.2, 0.2, 0.2);
const vec3 uLightingDirection =  normalize( vec3(0.25, 0.25, 1) );
const vec3 uDirectionalColor = vec3(0.8, 0.8, 0.8);

uniform mat4 uPMVMatrix;
uniform mat3 uNMatrix;

out vec3 vLightWeighting;
out vec4 fragmentColor;

#define PI 3.14159265359

uniform sampler3D inPos;

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

    ${getIndex(sz, sy, sx)}

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

    vec3 pos = vec3(texelFetch(inPos, ivec3(col, row, dep), 0));
    vec3 pos2 = pos + float(${radius}) * vec3(x, y, z);

    gl_Position = uPMVMatrix * vec4(pos2, 1.0);

    vec3 transformedNormal = uNMatrix * vec3(nx, ny, nz);

    float directionalLightWeighting = max(dot(transformedNormal, uLightingDirection), 0.0);
    vLightWeighting = uAmbientColor + uDirectionalColor * directionalLightWeighting;
}`;

    let pkg = new gpgputs.UserDef(bansho.gl.TRIANGLES, shader, gpgputs.GPGPU.planeFragmentShader, {
        inPos : gpgpu.makeTextureInfo("vec3" , [sz, sy, sx])
    });
    pkg.numInput = sz * sy * sx * n1 * n2 * 6;
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
    bansho.glb.view.gpgpu.makePackage(dr1);

    return Arrow3D(gpgpu, dr1, "pos", "vec", ncol, nrow, 1, 0.5, 0.5, 0.5);
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
    bansho.glb.view.gpgpu.makePackage(dr1);
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

    let dr2 = ArrowLine(gpgpu, dr1, "outPos", "outE", sx, sy, sz, 0.0, 0.0, 1.0);
    let dr3 = ArrowLine(gpgpu, dr1, "outPos", "outH", sx, sy, sz, 1.0, 0.0, 0.0);
    // let dr2 = Arrow3D(gpgpu, dr1, "outPos", "outE", sx, sy, sz, 0.0, 0.0, 1.0);
    // let dr3 = Arrow3D(gpgpu, dr1, "outPos", "outH", sx, sy, sz, 1.0, 0.0, 0.0);

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

function multibody(sz, sy, sx){ 
    return `

precision highp sampler3D;

uniform mat4 uPMVMatrix;
uniform int   tick;

uniform sampler3D inPos;
uniform sampler3D inVel;
uniform sampler3D inMass;

out vec3 outPos;
out vec3 outVel;
out float dmp;

out vec4 fragmentColor;
    
void main(void) {
    int idx = int(gl_VertexID);

    ${getIndex(sz, sy, sx)}

    vec3 pos = vec3(texelFetch(inPos, ivec3(col, row, dep), 0));
    vec3 vel = vec3(texelFetch(inVel, ivec3(col, row, dep), 0));
    if(tick % 1 == 0){

        float mass = texelFetch(inMass, ivec3(col, row, dep), 0).r;
        dmp    = mass;

        vec3 F = vec3(0.0, 0.0, 0.0);
        for(int dep1 = 0; dep1 < ${sz}; dep1++){
            for(int row1 = 0; row1 < ${sy}; row1++){
                for(int col1 = 0; col1 < ${sx}; col1++){
                    vec3 pos1 = vec3(texelFetch(inPos, ivec3(col1, row1, dep1), 0));
                    float mass1 = texelFetch(inMass, ivec3(col1, row1, dep1), 0).r;

                    float r = length(pos1 - pos);
            
                    if(r != 0.0){

                        r *= 100.0;
                        F += (mass * mass1 * 0.01 / (r * r)) * normalize(pos1 - pos);
                    }
                }
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
    let inPos = new Float32Array(sx * sy * sz * 3).map(x => 3 * Math.random() - 1.5);
    let inVel = new Float32Array(sx * sy * sz * 3).map(x => 0.05 * Math.random() - 0.025);
    let inMass  = new Float32Array(sx * sy * sz).map(x => 0.5 + Math.random());
    // let inMass  = new Float32Array(bansho.range(sx * sy * sz).map(x => 11 * x));


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

    // inMass[3] = 1000000;
    // inPos[3] = 0.7;
    

    let dr = new gpgputs.UserDef(gl.POINTS, multibody(sz, sy, sx) , gpgputs.GPGPU.pointFragmentShader,
    {
        inPos : gpgpu.makeTextureInfo("vec3" , [sz, sy, sx], inPos),
        inVel : gpgpu.makeTextureInfo("vec3" , [sz, sy, sx], inVel),
        inMass: gpgpu.makeTextureInfo("float", [sz, sy, sx], inMass),
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
// 粒子
//--------------------------------------------------

function particleTest(gpgpu){
    let gl = bansho.gl;
    let sx = 20, sy = 20; sz = 20;
    let inPos = new Float32Array(sx * sy * sz * 3).map(x => 3 * Math.random() - 1.5);
    let inVel = new Float32Array(sx * sy * sz * 3).map(x => 0.05 * Math.random() - 0.025);
    let inMass  = new Float32Array(sx * sy * sz).map(x => 0.5 + Math.random());
    // let inMass  = new Float32Array(bansho.range(sx * sy * sz).map(x => 11 * x));


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

    // inMass[3] = 1000000;
    // inPos[3] = 0.7;
    

    let dr1 = new gpgputs.UserDef(gl.POINTS, multibody(sz, sy, sx) , gpgputs.GPGPU.pointFragmentShader,
    {
        inPos : gpgpu.makeTextureInfo("vec3" , [sz, sy, sx], inPos),
        inVel : gpgpu.makeTextureInfo("vec3" , [sz, sy, sx], inVel),
        inMass: gpgpu.makeTextureInfo("float", [sz, sy, sx], inMass)
    });

    dr1.numInput = sz * sy * sx;
    gpgpu.makePackage(dr1);

    gpgpu.drawParam.z = -200;

    let n1 = 8, n2 = 8, radius = 2;
    let dr2 = particlePackage(gpgpu, sz, sy, sx, n1, n2, radius);

    dr1.bind("outPos", "inPos");
    dr1.bind("outPos", "inPos", dr2);

    return new gpgputs.ComponentDrawable([dr1, dr2]);
}


